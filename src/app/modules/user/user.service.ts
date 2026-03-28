import mongoose, { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { TUser } from './user.interface';
import { User } from './user.model';
import { sendEmail } from '../../utils/sendEmail';
import QueryBuilder from '../../builder/QueryBuilder';
import { userSearchableFields } from './user.constant';
import { deleteFromS3, uploadToS3 } from '../../utils/awsS3FileUploader';
import { generateReferralCode, generateStrongPassword } from './user.utils';

const signupUserIntoDB = async (payload: TUser & { referralCode?: string }) => {
  const existingEmail = await User.findOne({ email: payload.email });
  if (existingEmail) {
    throw new AppError(409, 'Email already exists');
  }

  const existingPhone = await User.findOne({ phone: payload.phone });
  if (existingPhone) {
    throw new AppError(409, 'Phone number already exists');
  }

  // ✅ referral code generate
  const myReferralCode = generateReferralCode(payload.fullName);

  // ✅ Only process if you have a referral code — optional
  let referredById: Types.ObjectId | undefined;

  if (payload.referralCode) {
    const referrer = await User.findOne({ referralCode: payload.referralCode });
    if (!referrer) throw new AppError(400, 'Invalid referral code');
    referredById = referrer._id as unknown as Types.ObjectId;
  }

  const user = await User.create({
    ...payload,
    isVerified: false,
    referralCode: myReferralCode,
    referredBy: referredById ?? null,
    referralRewarded: false,
    referralCount: 0,
    referralEarnings: 0,
  });

  return {
    userId: user._id,
    name: user.fullName,
    email: user.email,
    phone: user.phone,
    referralCode: user.referralCode,
    verificationOptions: ['email', 'phone'],
  };
};

const createCustomerByAdminIntoDB = async (payload: TUser) => {
  const { fullName, email, phone } = payload;

  // 1️⃣ Check customer already exists
  const isExistUser = await User.findOne({ email }).select(
    '_id fullName email phone image role status',
  );

  if (isExistUser) {
    return {
      message: 'User already exists.',
      user: isExistUser,
    };
  }

  // 2️⃣ Generate STRONG password (Zod compatible)
  const password = generateStrongPassword(); // 👈 plain password

  // 3️⃣ Create customer (NO hashing here)
  const newCustomer = await User.create({
    fullName,
    email,
    phone,
    role: 'customer',

    streetAddress: payload.streetAddress || 'N/A',
    city: payload.city || 'N/A',
    state: payload.state || 'N/A',
    zipCode: payload.zipCode || 'N/A',

    password, // ✅ plain password
    needsPasswordChange: true,
    isVerified: true,
    verification: {
      otp: '',
      expiresAt: new Date(),
      status: true,
    },
  });

  // 4️⃣ Send credentials
  await sendEmail(
    email,
    'Welcome to MohTress – Your Customer Account is Ready 🎉',
    `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #333;">
    
    <h2 style="color: #1f2937;">Hello ${fullName}, 👋</h2>

    <p>
      Welcome to <strong>MohTress</strong>!  
      An administrator has successfully created your customer account.
    </p>

    <p>
      You can now log in using the credentials below:
    </p>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Password:</strong> ${password}</p>
    </div>

    <p style="color: #b91c1c;">
      🔐 <strong>Important:</strong> For security reasons, please change your password immediately after your first login.
    </p>

    <p>
      If you did not request this account or have any questions,  
      please contact our support team.
    </p>

    <p style="margin-top: 32px;">
      Best regards,<br />
      <strong>MohTress Team</strong>
    </p>

    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />

    <p style="font-size: 12px; color: #6b7280;">
      © ${new Date().getFullYear()} MohTress. All rights reserved.
    </p>
  </div>
  `,
  );

  return {
    message: 'Customer account created successfully.',
    user: newCustomer,
  };
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
  signupUserIntoDB,
  createCustomerByAdminIntoDB,
  getAllUsersFromDB,
  getUserProfileFromDB,
  updateUserProfileIntoDB,
  updateUserPictureIntoDB,
  changeStatusIntoDB,
  deleteUserAccountFromDB,
  updateNotificationSettingsIntoDB,
};
