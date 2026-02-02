import mongoose from 'mongoose';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { TOwnerRegistration } from './ownerRegistration.interface';
import { deleteFromS3, uploadToS3 } from '../../utils/awsS3FileUploader';
import { OwnerRegistration } from './ownerRegistration.model';
import QueryBuilder from '../../builder/QueryBuilder';
import { OwnerSearchableFields } from './ownerRegistration.constant';
import { OwnerService } from '../ownerService/ownerService.model';
import { TUser } from '../user/user.interface';
import { sendEmail } from '../../utils/sendEmail';

const createOwnerRegistrationIntoDB = async (
  userId: string,
  data: TOwnerRegistration,
  files?: {
    idDocument?: Express.Multer.File[];
    businessRegistration?: Express.Multer.File[];
    salonFrontPhoto?: Express.Multer.File[];
    salonInsidePhoto?: Express.Multer.File[];
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
  const existingRegistration = await OwnerRegistration.findOne({
    user: user._id,
  });
  if (existingRegistration) {
    throw new AppError(400, 'Owner registration already exists for this user');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payload: Partial<TOwnerRegistration> = {
      ...data,
      user: user._id,
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
            fileName: `images/owner/${folder}/${Date.now()}-${Math.floor(
              1000 + Math.random() * 9000,
            )}`,
          });
          return uploadedUrl as string;
        }
        return undefined;
      };

      payload.idDocument = await uploadSingleFile(
        files.idDocument,
        'idDocument',
      );
      payload.businessRegistration = await uploadSingleFile(
        files.businessRegistration,
        'businessReg',
      );
      payload.salonFrontPhoto = await uploadSingleFile(
        files.salonFrontPhoto,
        'salonFront',
      );
      payload.salonInsidePhoto = await uploadSingleFile(
        files.salonInsidePhoto,
        'salonInside',
      );
    }

    const created = await OwnerRegistration.create([payload], { session });
    if (!created || created.length === 0) {
      throw new AppError(400, 'Failed to create owner registration');
    }

    const ownerRegId = created[0]._id;

    await User.findByIdAndUpdate(
      user._id,
      {
        isRegistration: true,
        ownerReg: ownerRegId,
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
    throw new AppError(500, error.message || 'Owner registration failed');
  }
};

const getAllOwnerRegistrationFromDB = async (
  query: Record<string, unknown>,
) => {
  const baseQuery: Record<string, any> = { isDeleted: false };

  // 🔍 Build service filter
  const serviceFilter: Record<string, any> = { isDeleted: false };

  // ⭐ Subcategory filter
  if (query.subcategory) {
    serviceFilter.subcategory = query.subcategory;
    delete query.subcategory;
  }

  // ⭐ Service name filter (partial match)
  if (query.serviceName) {
    const serviceNames = Array.isArray(query.serviceName)
      ? query.serviceName
      : String(query.serviceName).split(',');

    serviceFilter.name = {
      $in: serviceNames.map((name) => new RegExp(name.trim(), 'i')),
    };

    delete query.serviceName;
  }

  // ⭐ Price range filter
  if (query.minPrice || query.maxPrice) {
    serviceFilter.price = {};
    if (query.minPrice) serviceFilter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) serviceFilter.price.$lte = Number(query.maxPrice);

    delete query.minPrice;
    delete query.maxPrice;
  }

  // 🔗 If any service-related filter exists
  if (Object.keys(serviceFilter).length > 1) {
    const services = await OwnerService.find(serviceFilter).select('_id');
    const serviceIds = services.map((s) => s._id);

    // Apply even if empty (returns empty result)
    baseQuery.services = { $in: serviceIds };
  }

  // 🔹 QueryBuilder (unchanged behavior)
  const ownerRegistrationQuery = new QueryBuilder(
    OwnerRegistration.find(baseQuery)
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
    .search(OwnerSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await ownerRegistrationQuery.countTotal();
  const result = await ownerRegistrationQuery.modelQuery;

  return { meta, result };
};

const getAllOwnerRequestFromDB = async (query: Record<string, unknown>) => {
  // 1️⃣ Base query: only pending or rejected
  let mongooseQuery = OwnerRegistration.find({
    isDeleted: false,
    approvalStatus: { $in: ['pending', 'rejected'] }, // <-- filter
  });

  // 2️⃣ Apply search, filter, sort, paginate, fields
  const ownersQuery = new QueryBuilder(mongooseQuery, query)
    .search(OwnerSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  // 3️⃣ Populate user info after QueryBuilder
  ownersQuery.modelQuery = ownersQuery.modelQuery.populate({
    path: 'user',
    select: 'fullName email phone image gender role',
  });

  // 4️⃣ Get total count and results
  const meta = await ownersQuery.countTotal();
  const result = await ownersQuery.modelQuery;

  return { meta, result };
};

const getOwnerRegistrationByIdFromDB = async (id: string) => {
  const result = await OwnerRegistration.findById(id).populate({
    path: 'user',
    select: 'fullName email phone image gender role',
  });

  if (!result) {
    throw new AppError(404, 'This owner not found');
  }

  return result;
};

const getOwnerProfileFromDB = async (userId: string) => {
  const user = await User.findById(userId).select('role isRegistration');
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  console.log(userId);

  if (user.role !== 'owner') {
    throw new AppError(403, 'Only owner can perform this access');
  }

  if (user.isRegistration === false) {
    throw new AppError(400, 'Owner registration not completed');
  }

  const result = await OwnerRegistration.findOne({ user: user._id }).populate({
    path: 'user',
    select: '-password -needsPasswordChange',
  });

  if (!result) {
    throw new AppError(404, 'This owner not found');
  }

  return result;
};

const updateOwnerRegistrationIntoDB = async (
  userId: string,
  id: string,
  payload: Partial<TOwnerRegistration>,
  file?: Express.Multer.File,
) => {
  // 🔍 Step 0: Check if the user exists
  const user = await User.findById(userId).select('role isRegistration');
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  if (user.role !== 'owner') {
    throw new AppError(403, 'Only owner can perform this action');
  }

  if (user.isRegistration === false) {
    throw new AppError(400, 'Owner registration not completed');
  }

  // 🔍 Step 1: Check existing owner
  const existingOwner = await OwnerRegistration.findById(id);
  if (!existingOwner) {
    throw new AppError(404, 'Owner not found');
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

      // 🧹 Delete previous image
      if (existingOwner.salonPhoto) {
        await deleteFromS3(existingOwner.salonPhoto);
      }

      payload.salonPhoto = uploadedUrl;
    }

    // 🔄 Step 3: Update owner registration
    const updatedOwner = await OwnerRegistration.findByIdAndUpdate(
      id,
      payload,
      {
        new: true,
        runValidators: true,
        session,
      },
    );

    if (!updatedOwner) {
      throw new AppError(400, 'Owner update failed');
    }

    // 📍 Step 4: Update user location
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

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return updatedOwner;
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    throw new AppError(500, error.message || 'Failed to update owner');
  }
};

const ownerApprovalRequestIntoDB = async (
  id: string,
  payload: { approvalStatus: string },
) => {
  // 1️⃣ Check salon owner + populate user
  const isOwnerExists = await OwnerRegistration.findById(id).populate({
    path: 'user',
    select: 'fullName email',
  });

  if (!isOwnerExists) {
    throw new AppError(404, 'This salon owner is not found');
  }

  // 2️⃣ Type narrow populated user safely
  const user = isOwnerExists.user as unknown as TUser;

  if (!user.email) {
    throw new AppError(500, 'User email not found');
  }

  // 3️⃣ Update status
  const result = await OwnerRegistration.findByIdAndUpdate(id, payload, {
    new: true,
  });

  // 4️⃣ Send approval email
  if (payload.approvalStatus === 'approved') {
    await sendEmail(
      user.email,
      `🎉 Your Salon Owner Account Has Been Approved!`,
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Salon Owner Approved</title>
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
                Great news! Your salon owner account has been successfully approved.
              </p>

              <p style="font-size:14px;color:#444;margin-bottom:20px;">
                You can now manage your salon, receive appointments, and access the full features of our platform.
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

const ownerRejectedRequestIntoDB = async (
  id: string,
  payload: { approvalStatus: string; notes: string },
) => {
  // 1️⃣ Get salon owner with user info
  const owner = await OwnerRegistration.findById(id).populate({
    path: 'user',
    select: 'fullName email',
  });

  if (!owner) {
    throw new AppError(404, 'This salon owner is not found');
  }

  // 2️⃣ Safely narrow user type
  const user = owner.user as unknown as TUser;

  if (!user?.email) {
    throw new AppError(500, 'User email not found');
  }

  // 3️⃣ Update approval status + notes
  const updatedOwner = await OwnerRegistration.findByIdAndUpdate(id, payload, {
    new: true,
  });

  // 4️⃣ If rejected → Send rejection email
  if (payload.approvalStatus === 'rejected') {
    const subject = `❗ Your Salon Owner Account Request Was Rejected`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Salon Owner Rejected</title>
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
                We regret to inform you that your salon owner account request has been 
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

  return updatedOwner;
};

export const OwnerRegistrationService = {
  createOwnerRegistrationIntoDB,
  getAllOwnerRegistrationFromDB,
  getAllOwnerRequestFromDB,
  getOwnerRegistrationByIdFromDB,
  getOwnerProfileFromDB,
  updateOwnerRegistrationIntoDB,
  ownerApprovalRequestIntoDB,
  ownerRejectedRequestIntoDB,
};
