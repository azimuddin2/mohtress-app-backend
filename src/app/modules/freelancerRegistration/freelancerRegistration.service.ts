import mongoose from 'mongoose';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { deleteFromS3, uploadToS3 } from '../../utils/awsS3FileUploader';
import { TFreelancerRegistration } from './freelancerRegistration.interface';
import { FreelancerRegistration } from './freelancerRegistration.model';
import QueryBuilder from '../../builder/QueryBuilder';
import { FreelancerSearchableFields } from './freelancerRegistration.constant';
import { FreelancerService } from '../freelancerService/freelancerService.model';
import { sendEmail } from '../../utils/sendEmail';
import { TUser } from '../user/user.interface';

const createFreelancerRegistrationIntoDB = async (
  userId: string,
  data: TFreelancerRegistration,
  files?: {
    profile?: Express.Multer.File[];
    idDocument?: Express.Multer.File[];
    businessRegistration?: Express.Multer.File[];
  },
) => {
  const user = await User.findById(userId).select(
    'status isDeleted isRegistration',
  );
  if (!user) {
    throw new AppError(404, 'User not found');
  } else if (user.isDeleted) {
    throw new AppError(403, 'User is deleted');
  } else if (user.status === 'blocked') {
    throw new AppError(403, 'User is blocked');
  }

  // 🛑 Check if user already registered
  if (user.isRegistration) {
    throw new AppError(400, 'You have already completed your registration');
  }

  // ✅ Optional: double-check if an owner registration record already exists
  const existingRegistration = await FreelancerRegistration.findOne({
    user: user._id,
  });
  if (existingRegistration) {
    throw new AppError(
      400,
      'Freelancer registration already exists for this user',
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payload: Partial<TFreelancerRegistration> = {
      user: user._id,
      experienceYear: data.experienceYear,
      about: data.about,
      openingHours: data.openingHours,
      availability: data.availability,
    };

    // 📸 Handle uploads
    if (files) {
      const uploadSingleFile = async (
        fileArray: Express.Multer.File[] | undefined,
        folder: string,
      ): Promise<string | undefined> => {
        if (fileArray && fileArray[0]) {
          const file = fileArray[0];
          const uploadedUrl = await uploadToS3({
            file,
            fileName: `images/freelancer/${folder}/${Date.now()}-${Math.floor(
              1000 + Math.random() * 9000,
            )}`,
          });
          return uploadedUrl as string;
        }
        return undefined;
      };

      payload.profile = await uploadSingleFile(files.profile, 'profile');
      payload.idDocument = await uploadSingleFile(
        files.idDocument,
        'idDocument',
      );
      payload.businessRegistration = await uploadSingleFile(
        files.businessRegistration,
        'businessReg',
      );
    }

    const created = await FreelancerRegistration.create([payload], { session });
    if (!created || created.length === 0) {
      throw new AppError(400, 'Failed to create freelancer registration');
    }

    const freelancerRegId = created[0]._id;

    await User.findByIdAndUpdate(
      user._id,
      {
        isRegistration: true,
        freelancerReg: freelancerRegId,
        ...(data.location && {
          location: {
            type: 'Point',
            coordinates: data.location.coordinates,
            streetAddress: data.location.streetAddress,
          },
        }),
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return created[0];
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    throw new AppError(500, error.message || 'Freelancer registration failed');
  }
};

const getAllFreelancersFromDB = async (query: Record<string, unknown>) => {
  const baseQuery: Record<string, any> = { isDeleted: false };

  /**
   * 🔍 Service-level filter (FreelancerService)
   * These fields DO NOT exist in FreelancerRegistration,
   * so they must be handled here and removed from query.
   */
  const serviceFilter: Record<string, any> = {
    isDeleted: false,
    status: 'available',
  };

  // ⭐ Availability filter (array field)
  if (query.availability) {
    const availabilityValues = Array.isArray(query.availability)
      ? query.availability
      : String(query.availability).split(',');

    baseQuery.availability = {
      $in: availabilityValues.map((v) => v.trim()),
    };

    delete query.availability;
  }

  // ⭐ Subcategory filter
  if (query.subcategory) {
    serviceFilter.subcategory = query.subcategory;
    delete query.subcategory;
  }

  // ⭐ Multiple service name filter (Hair,Facial,Spa)
  if (query.serviceName) {
    const serviceNames = Array.isArray(query.serviceName)
      ? query.serviceName
      : String(query.serviceName).split(',');

    serviceFilter.name = {
      $in: serviceNames.map((name) => new RegExp(name.trim(), 'i')),
    };

    delete query.serviceName;
  }

  // ⭐ Price range filter (minPrice / maxPrice)
  if (query.minPrice || query.maxPrice) {
    serviceFilter.price = {};

    if (query.minPrice) {
      serviceFilter.price.$gte = Number(query.minPrice);
    }

    if (query.maxPrice) {
      serviceFilter.price.$lte = Number(query.maxPrice);
    }

    delete query.minPrice;
    delete query.maxPrice;
  }

  /**
   * 🔗 Apply service filter only when
   * service-related conditions exist
   */
  if (Object.keys(serviceFilter).length > 2) {
    const services = await FreelancerService.find(serviceFilter).select('_id');
    const serviceIds = services.map((s) => s._id);

    // Always apply filter (even if empty)
    baseQuery.services = { $in: serviceIds };
  }

  /**
   * 🔹 QueryBuilder (UNCHANGED)
   */
  const freelancerQuery = new QueryBuilder(
    FreelancerRegistration.find(baseQuery)
      .populate({
        path: 'user',
        select: '-password -needsPasswordChange',
      })
      .populate({
        path: 'services',
        match: baseQuery.services
          ? { _id: { $in: baseQuery.services.$in } }
          : {},
      }),
    query,
  )
    .search(FreelancerSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await freelancerQuery.countTotal();
  const result = await freelancerQuery.modelQuery;

  return { meta, result };
};

const getAllFreelancerRequestFromDB = async (
  query: Record<string, unknown>,
) => {
  // 1️⃣ Start with base query only for pending or rejected
  let mongooseQuery = FreelancerRegistration.find({
    isDeleted: false,
    approvalStatus: { $in: ['pending', 'rejected'] }, // <-- filter
  });

  // 2️⃣ Apply search, filter, sort, paginate, fields
  const freelancersQuery = new QueryBuilder(mongooseQuery, query)
    .search(FreelancerSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  // 3️⃣ Populate user info after QueryBuilder
  freelancersQuery.modelQuery = freelancersQuery.modelQuery.populate({
    path: 'user',
    select: 'fullName email phone image gender role',
  });

  // 4️⃣ Get total count and final results
  const meta = await freelancersQuery.countTotal();
  const result = await freelancersQuery.modelQuery;

  return { meta, result };
};

const getFreelancerByIdFromDB = async (id: string) => {
  const result = await FreelancerRegistration.findById(id).populate({
    path: 'user',
    select: 'fullName email phone image gender role',
  });

  if (!result) {
    throw new AppError(404, 'This freelancer not found');
  }

  return result;
};

const getFreelancerProfileFromDB = async (userId: string) => {
  const user = await User.findById(userId).select('role isRegistration');
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  if (user.role !== 'freelancer') {
    throw new AppError(403, 'Only freelancer can perform this access');
  }

  if (user.isRegistration === false) {
    throw new AppError(400, 'Freelancer registration not completed');
  }

  const result = await FreelancerRegistration.findOne({
    user: user._id,
  }).populate({
    path: 'user',
    select: '-password -needsPasswordChange',
  });

  if (!result) {
    throw new AppError(404, 'This freelancer not found');
  }

  return result;
};

const updateFreelancerRegistrationIntoDB = async (
  userId: string,
  id: string,
  payload: Partial<TFreelancerRegistration>,
  file?: Express.Multer.File,
) => {
  // 🔍 Step 0: Check if the user exists
  const user = await User.findById(userId).select('role isRegistration');
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  if (user.role !== 'freelancer') {
    throw new AppError(403, 'Only freelancer can perform this action');
  }

  if (!user.isRegistration) {
    throw new AppError(400, 'Freelancer registration not completed');
  }

  // 🔍 Step 1: Check if the specialist member exists
  const existingFreelancer = await FreelancerRegistration.findById(id);
  if (!existingFreelancer) {
    throw new AppError(404, 'Freelancer not found');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 📸 Step 2: Handle new image upload
    if (file) {
      const uploadedUrl = await uploadToS3({
        file,
        fileName: `images/salon/${Math.floor(100000 + Math.random() * 900000)}`,
      });

      // 🧹 Delete old image
      if (existingFreelancer.salonPhoto) {
        await deleteFromS3(existingFreelancer.salonPhoto);
      }

      // Add new image to payload
      payload.salonPhoto = uploadedUrl;
    }

    // 🔄 Step 3: Update freelancer registration
    const updatedFreelancer = await FreelancerRegistration.findByIdAndUpdate(
      id,
      payload,
      {
        new: true,
        runValidators: true,
        session,
      },
    );

    if (!updatedFreelancer) {
      throw new AppError(400, 'Freelancer update failed');
    }

    // 📍 Step 4: Update user location inside same transaction
    if (payload.location) {
      await User.findByIdAndUpdate(
        userId,
        {
          location: {
            type: 'Point',
            coordinates: payload.location.coordinates,
            streetAddress: payload.location.streetAddress,
          },
        },
        { runValidators: true, session },
      );
    }

    // Commit
    await session.commitTransaction();
    session.endSession();

    return updatedFreelancer;
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    throw new AppError(500, error.message || 'Failed to update freelancer');
  }
};

const freelancerApprovalRequestIntoDB = async (
  id: string,
  payload: { approvalStatus: string },
) => {
  // 1️⃣ Check freelancer + populate user
  const isFreelancerExists = await FreelancerRegistration.findById(id).populate(
    {
      path: 'user',
      select: 'fullName email',
    },
  );

  if (!isFreelancerExists) {
    throw new AppError(404, 'This freelancer is not found');
  }

  // 2️⃣ Type narrow populated user safely
  const user = isFreelancerExists.user as unknown as TUser;

  if (!user.email) {
    throw new AppError(500, 'User email not found');
  }

  // 3️⃣ Update status
  const result = await FreelancerRegistration.findByIdAndUpdate(id, payload, {
    new: true,
  });

  // 4️⃣ Send approval email
  if (payload.approvalStatus === 'approved') {
    await sendEmail(
      user.email,
      `🎉 Your Freelancer Account Has Been Approved!`,
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Freelancer Approved</title>
      </head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial, sans-serif;">
        
        <table align="center" width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff;padding:30px;border-radius:8px;
                 box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          
          <tr>
            <td>
              <h2 style="color:#28a745;margin:0 0 15px 0;">
                Congratulations ${user.fullName}! 🎉
              </h2>

              <p style="font-size:15px;color:#333;margin-bottom:20px;">
                Great news! Your freelancer profile has been successfully approved.
              </p>

              <p style="font-size:14px;color:#444;margin-bottom:20px;">
                You can now start receiving bookings and providing services through our platform.
                We’re excited to have you on board!
              </p>

              <p style="font-size:14px;color:#666;margin-top:20px;">
                If you have any questions, feel free to contact our support team anytime.
              </p>

              <p style="margin-top:30px;font-size:13px;color:#999;">
                Best Regards,<br/>
                <strong>BraidNYC Team</strong>
              </p>
            </td>
          </tr>

        </table>
      </body>
      </html>
      `,
    );
  }

  return result;
};

const freelancerRejectedRequestIntoDB = async (
  id: string,
  payload: { approvalStatus: string; notes: string },
) => {
  // 1️⃣ Get freelancer with user info
  const freelancer = await FreelancerRegistration.findById(id).populate({
    path: 'user',
    select: 'fullName email',
  });

  if (!freelancer) {
    throw new AppError(404, 'This freelancer is not found');
  }

  // 2️⃣ Safely narrow user type
  const user = freelancer.user as unknown as TUser;

  if (!user?.email) {
    throw new AppError(500, 'User email not found');
  }

  // 3️⃣ Update approval status + notes
  const updatedFreelancer = await FreelancerRegistration.findByIdAndUpdate(
    id,
    payload,
    { new: true },
  );

  // 4️⃣ If rejected → Send rejection email
  if (payload.approvalStatus === 'rejected') {
    const subject = `❗ Your Freelancer Account Request Was Rejected`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Freelancer Rejected</title>
      </head>
      <body style="margin:0;padding:0;background:#fafafa;font-family:Arial, sans-serif;">
        
        <table align="center" width="600" cellpadding="0" cellspacing="0"
          style="
            background:#ffffff;
            padding:30px;
            border-radius:8px;
            box-shadow:0 2px 8px rgba(0,0,0,0.06);
          ">
          
          <tr>
            <td>
              <h2 style="color:#d9534f;margin:0 0 15px 0;">
                Hello ${user.fullName},
              </h2>

              <p style="font-size:15px;color:#333;margin-bottom:20px;">
                We regret to inform you that your freelancer profile request has been 
                <strong>rejected</strong>.
              </p>

              <p style="font-size:14px;color:#555;margin-bottom:20px;line-height:1.6;">
                Below is the feedback provided by our review team:
              </p>

              <blockquote 
                style="
                  border-left:4px solid #d9534f;
                  padding-left:10px;
                  margin:15px 0;
                  color:#444;
                  font-size:14px;
                  line-height:1.6;
                ">
                ${payload.notes || 'No additional notes were provided.'}
              </blockquote>

              <p style="font-size:14px;color:#555;margin-bottom:20px;line-height:1.6;">
                Please review the remarks above and try applying again after updating your information.
              </p>

              <p style="font-size:14px;color:#666;">
                If you believe this was a mistake or need more clarification, feel free to contact our support team.
              </p>

              <p style="margin-top:30px;font-size:13px;color:#999;">
                Best Regards,<br/>
                <strong>BraidNYC Team</strong>
              </p>
            </td>
          </tr>

        </table>
      </body>
      </html>
    `;

    await sendEmail(user.email, subject, htmlContent);
  }

  return updatedFreelancer;
};

export const FreelancerRegistrationService = {
  createFreelancerRegistrationIntoDB,
  getAllFreelancersFromDB,
  getAllFreelancerRequestFromDB,
  getFreelancerByIdFromDB,
  getFreelancerProfileFromDB,
  updateFreelancerRegistrationIntoDB,
  freelancerApprovalRequestIntoDB,
  freelancerRejectedRequestIntoDB,
};
