import mongoose from 'mongoose';
import AppError from '../../errors/AppError';
import { TUser } from './user.interface';
import { User } from './user.model';
import { generateOtp } from '../../utils/generateOtp';
import moment from 'moment';
import config from '../../config';
import { sendEmail } from '../../utils/sendEmail';
import { TJwtPayload } from '../auth/auth.interface';
import { createToken } from '../auth/auth.utils';
import QueryBuilder from '../../builder/QueryBuilder';
import { userSearchableFields } from './user.constant';
import { deleteFromS3, uploadToS3 } from '../../utils/awsS3FileUploader';

const signupCustomerIntoDB = async (payload: TUser) => {
  // 1. Check if user already exists
  const existingUser = await User.findOne({ email: payload.email });
  if (existingUser) {
    throw new AppError(409, `${payload.email} already exists.`);
  }

  // 2. Generate OTP and expiration
  const otp = generateOtp();
  const expiresAt = moment().add(3, 'minutes').toDate();

  // 3. Prepare data with verification details
  const userData: Partial<TUser> = {
    ...payload,
    role: 'customer',
    isVerified: false,
    verification: {
      otp,
      expiresAt,
      status: false,
    },
  };

  // 4. Create user in DB
  const result = await User.create(userData);

  // 5. Create JWT token (optional for next step)
  const jwtPayload: TJwtPayload = {
    userId: result._id,
    name: result?.fullName,
    email: result?.email,
    role: result?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    '5m',
  );

  // 6. Send OTP email
  await sendEmail(
    result.email,
    'Your OTP Code',
    `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OTP Verification</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 30px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
            <tr>
              <td align="center" style="padding-bottom: 20px;">
                <h2 style="color: #007BFF; margin: 0;">Verify Your Email</h2>
              </td>
            </tr>
            <tr>
              <td style="font-size: 16px; color: #333333; padding-bottom: 20px; text-align: center;">
                <p style="margin: 0;">Use the OTP below to verify your email address and complete your registration:</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 20px 0;">
                <div style="display: inline-block; padding: 15px 30px; font-size: 24px; font-weight: bold; color: #ffffff; background-color: #007BFF; border-radius: 6px; letter-spacing: 2px;">
                  ${otp}
                </div>
              </td>
            </tr>
            <tr>
              <td style="font-size: 14px; color: #666666; text-align: center; padding-bottom: 20px;">
                <p style="margin: 0;">This code is valid until <strong>${expiresAt.toLocaleString()}</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #999999; text-align: center;">
                <p style="margin: 0;">If you did not request this code, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 30px; text-align: center;">
                <p style="font-size: 12px; color: #cccccc; margin: 0;">&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `,
  );

  return { accessToken };
};

const signupOwnerIntoDB = async (payload: TUser) => {
  // 1. Check if user already exists
  const existingUser = await User.findOne({ email: payload.email });
  if (existingUser) {
    throw new AppError(409, `${payload.email} already exists.`);
  }

  // 2. Generate OTP and expiration
  const otp = generateOtp();
  const expiresAt = moment().add(3, 'minutes').toDate();

  // 3. Prepare data with verification details
  const userData: Partial<TUser> = {
    ...payload,
    role: 'owner',
    isVerified: false,
    verification: {
      otp,
      expiresAt,
      status: false,
    },
  };

  // 4. Create user in DB
  const result = await User.create(userData);

  // 5. Create JWT token (optional for next step)
  const jwtPayload: TJwtPayload = {
    userId: result._id,
    name: result?.fullName,
    email: result?.email,
    role: result?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    '5m',
  );

  // 7. Send OTP email
  await sendEmail(
    result.email,
    'Your OTP Code',
    `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OTP Verification</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 30px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
            <tr>
              <td align="center" style="padding-bottom: 20px;">
                <h2 style="color: #007BFF; margin: 0;">Verify Your Email</h2>
              </td>
            </tr>
            <tr>
              <td style="font-size: 16px; color: #333333; padding-bottom: 20px; text-align: center;">
                <p style="margin: 0;">Use the OTP below to verify your email address and complete your registration:</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 20px 0;">
                <div style="display: inline-block; padding: 15px 30px; font-size: 24px; font-weight: bold; color: #ffffff; background-color: #007BFF; border-radius: 6px; letter-spacing: 2px;">
                  ${otp}
                </div>
              </td>
            </tr>
            <tr>
              <td style="font-size: 14px; color: #666666; text-align: center; padding-bottom: 20px;">
                <p style="margin: 0;">This code is valid until <strong>${expiresAt.toLocaleString()}</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #999999; text-align: center;">
                <p style="margin: 0;">If you did not request this code, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 30px; text-align: center;">
                <p style="font-size: 12px; color: #cccccc; margin: 0;">&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `,
  );

  return { accessToken };
};

const signupFreelancerIntoDB = async (payload: TUser) => {
  // 1. Check if user already exists
  const existingUser = await User.findOne({ email: payload.email });
  if (existingUser) {
    throw new AppError(409, `${payload.email} already exists.`);
  }

  // 2. Generate OTP and expiration
  const otp = generateOtp();
  const expiresAt = moment().add(3, 'minutes').toDate();

  // 3. Prepare data with verification details
  const userData: Partial<TUser> = {
    ...payload,
    role: 'freelancer',
    isVerified: false,
    verification: {
      otp,
      expiresAt,
      status: false,
    },
  };

  // 4. Create user in DB
  const result = await User.create(userData);

  // 5. Create JWT token (optional for next step)
  const jwtPayload: TJwtPayload = {
    userId: result._id,
    name: result?.fullName,
    email: result?.email,
    role: result?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    '5m',
  );

  // 6. Send OTP email
  await sendEmail(
    result.email,
    'Your OTP Code',
    `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OTP Verification</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 30px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
            <tr>
              <td align="center" style="padding-bottom: 20px;">
                <h2 style="color: #007BFF; margin: 0;">Verify Your Email</h2>
              </td>
            </tr>
            <tr>
              <td style="font-size: 16px; color: #333333; padding-bottom: 20px; text-align: center;">
                <p style="margin: 0;">Use the OTP below to verify your email address and complete your registration:</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 20px 0;">
                <div style="display: inline-block; padding: 15px 30px; font-size: 24px; font-weight: bold; color: #ffffff; background-color: #007BFF; border-radius: 6px; letter-spacing: 2px;">
                  ${otp}
                </div>
              </td>
            </tr>
            <tr>
              <td style="font-size: 14px; color: #666666; text-align: center; padding-bottom: 20px;">
                <p style="margin: 0;">This code is valid until <strong>${expiresAt.toLocaleString()}</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #999999; text-align: center;">
                <p style="margin: 0;">If you did not request this code, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 30px; text-align: center;">
                <p style="font-size: 12px; color: #cccccc; margin: 0;">&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `,
  );

  return { accessToken };
};

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const { role, ...otherQuery } = query;

  // Role required
  if (!role) {
    throw new AppError(400, 'Role is required');
  }

  const validRoles = ['customer', 'owner', 'freelancer'];
  if (!validRoles.includes(role as string)) {
    throw new AppError(400, 'Invalid role');
  }

  // Base query
  const baseQuery: any = {
    ...otherQuery,
    isDeleted: false,
    role,
  };

  let mongooseQuery = User.find();

  // ===== Owner with ONLY approved registration =====
  if (role === 'owner') {
    mongooseQuery = mongooseQuery.populate({
      path: 'ownerReg',
      match: { approvalStatus: 'approved' }, // ✅ Only approved
      populate: {
        path: 'reviews',
        model: 'Review',
        populate: {
          path: 'user',
          select: 'fullName image',
        },
      },
    });
  }

  // ===== Freelancer with ONLY approved registration =====
  if (role === 'freelancer') {
    mongooseQuery = mongooseQuery.populate({
      path: 'freelancerReg',
      match: { approvalStatus: 'approved' }, // ✅ Only approved
      populate: {
        path: 'reviews',
        model: 'Review',
        populate: {
          path: 'user',
          select: 'fullName image',
        },
      },
    });
  }

  // Query builder (pagination, sort, search, filter)
  const queryBuilder = new QueryBuilder(mongooseQuery, baseQuery)
    .search(userSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await queryBuilder.countTotal();

  let result = await queryBuilder.modelQuery;

  // Remove users whose reg is NOT approved (null after match)
  if (role === 'owner') {
    result = result.filter((user: any) => user.ownerReg);
  }

  if (role === 'freelancer') {
    result = result.filter((user: any) => user.freelancerReg);
  }

  return { meta, result };
};

const getUserProfileFromDB = async (email: string) => {
  const result = await User.findOne({ email: email }).select('-password');

  if (!result) {
    throw new AppError(404, 'This user not found');
  }

  if (result?.isDeleted === true) {
    throw new AppError(403, 'This user is deleted!');
  }

  if (result?.status === 'blocked') {
    throw new AppError(403, 'This user is blocked!');
  }

  return result;
};

const updateUserProfileIntoDB = async (email: string, payload: TUser) => {
  // 🔍 Step 1: Check if user exists & get email
  const existingUser = await User.findOne({ email }).select('');
  if (!existingUser) {
    throw new AppError(404, 'User not found');
  }

  if (existingUser?.isDeleted === true) {
    throw new AppError(403, 'This user account is deleted!');
  }

  if (existingUser?.status === 'blocked') {
    throw new AppError(403, 'This user is blocked!');
  }

  const updatedUser = await User.findOneAndUpdate({ email: email }, payload, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    throw new AppError(400, 'profile update failed');
  }

  return updatedUser;
};

const updateUserPictureIntoDB = async (
  email: string,
  file: Express.Multer.File,
) => {
  // 🔍 Step 1: Check if user exists
  const existingUser = await User.findOne({ email }).select(
    'image status isDeleted',
  );
  if (!existingUser) {
    throw new AppError(404, 'User not found');
  }

  if (existingUser.isDeleted) {
    throw new AppError(403, 'This user is deleted!');
  }

  if (existingUser.status === 'blocked') {
    throw new AppError(403, 'This user is blocked!');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payload: Record<string, any> = {}; // ✅ initialize payload

    // 📸 Step 2: Handle image upload
    if (file) {
      const uploadedUrl = await uploadToS3({
        file,
        fileName: `images/user/profile/${Date.now()}-${Math.floor(
          1000 + Math.random() * 9000,
        )}`,
      });

      // 🧹 Delete old image if exists
      if (existingUser.image) {
        await deleteFromS3(existingUser.image);
      }

      payload.image = uploadedUrl; // ✅ set image in payload
    }

    // 📝 Step 3: Update user
    const updatedUser = await User.findByIdAndUpdate(
      existingUser._id,
      { $set: payload },
      { new: true, runValidators: true, session },
    ).select('_id fullName email image');

    if (!updatedUser) {
      throw new AppError(400, 'Failed to update user');
    }

    // ✅ Step 4: Commit transaction
    await session.commitTransaction();
    session.endSession();

    return updatedUser;
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    throw new AppError(500, error.message || 'User profile update failed');
  }
};

const changeStatusIntoDB = async (id: string, payload: { status: string }) => {
  const result = await User.findByIdAndUpdate(id, payload, { new: true });

  if (!result) {
    throw new AppError(404, 'User not found');
  }

  return result;
};

const deleteUserAccountFromDB = async (userId: string) => {
  // 1️⃣ Check if user exists
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');

  // 2️⃣ Mark account as deleted
  const deletedUser = await User.findByIdAndUpdate(
    userId,
    { isDeleted: true },
    { new: true },
  );
  if (!deletedUser) throw new AppError(400, 'Failed to delete user account');

  // 3️⃣ Send notification email
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; text-align: center;">
        <h2 style="color: #FF4D4F;">Account Deleted</h2>
        <p>Hi ${deletedUser.fullName || 'User'},</p>
        <p>Your account has been successfully deleted as per your request or by admin action.</p>
        <p>If you did not request this action, please contact our support immediately.</p>
        <p style="margin-top: 30px; font-size: 12px; color: #999999;">&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
      </div>
    </div>
  `;

  await sendEmail(deletedUser.email, 'Account Deleted', emailHtml);

  return deletedUser;
};

const updateNotificationSettingsIntoDB = async (
  email: string,
  notifications: boolean,
) => {
  // 🔍 Step 1: Check if user exists & get email
  const existingUser = await User.findOne({ email }).select('');
  if (!existingUser) {
    throw new AppError(404, 'User not found');
  }

  if (existingUser?.isDeleted === true) {
    throw new AppError(403, 'This user account is deleted!');
  }

  if (existingUser?.status === 'blocked') {
    throw new AppError(403, 'This user is blocked!');
  }

  const updatedUser = await User.findOneAndUpdate(
    { email: email },
    { notifications },
    {
      new: true,
      runValidators: true,
    },
  ).select('email notifications fullName');

  if (!updatedUser) {
    throw new AppError(400, 'Notification settings update failed');
  }

  return updatedUser;
};

export const UserServices = {
  signupCustomerIntoDB,
  signupOwnerIntoDB,
  signupFreelancerIntoDB,
  getAllUsersFromDB,
  getUserProfileFromDB,
  updateUserProfileIntoDB,
  updateUserPictureIntoDB,
  changeStatusIntoDB,
  deleteUserAccountFromDB,
  updateNotificationSettingsIntoDB,
};
