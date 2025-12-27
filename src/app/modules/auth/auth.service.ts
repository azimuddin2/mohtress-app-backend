import AppError from '../../errors/AppError';
import {
  TChangePassword,
  TJwtPayload,
  TLoginUser,
  TResetPassword,
} from './auth.interface';
import config from '../../config';
import { User } from '../user/user.model';
import { verifyToken } from '../../utils/verifyToken';
import { createToken } from './auth.utils';
import { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { generateOtp } from '../../utils/generateOtp';
import moment from 'moment';
import { sendEmail } from '../../utils/sendEmail';
import { TFreelancerRegistration } from '../freelancerRegistration/freelancerRegistration.interface';
import { TOwnerRegistration } from '../ownerRegistration/ownerRegistration.interface';
import { TUser } from '../user/user.interface';
import { sendNotification } from '../notification/notification.utils';
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
import httpStatus from 'http-status';
import { Login_With, USER_ROLE } from '../user/user.constant';
import firebaseAdmin from '../../utils/firebase';

const loginUser = async (payload: TLoginUser) => {
  // 1️⃣ Find user and populate profiles
  const user = await User.findOne({ email: payload.email })
    .populate('freelancerReg')
    .populate('ownerReg');

  if (!user) throw new AppError(404, 'This user is not found!');
  if (user.isDeleted) throw new AppError(403, 'This user account is deleted!');
  if (user.status === 'blocked')
    throw new AppError(403, 'This user is blocked!');

  // 2️⃣ Password check
  const isPasswordMatched = await User.isPasswordMatched(
    payload.password,
    user.password,
  );
  if (!isPasswordMatched) throw new AppError(403, 'Password does not match!');

  // 3️⃣ Handle incomplete owner registration
  if (user.role === 'owner' && !user.ownerReg) {
    const jwtPayload: TJwtPayload = {
      userId: user._id.toString(),
      name: user.fullName,
      email: user.email,
      role: 'owner', // special limited token
    };

    const token = createToken(
      jwtPayload,
      config.jwt_access_secret as string,
      config.jwt_access_expires_in as string,
    );

    return {
      accessToken: token,
      registrationRequired: true, // frontend can redirect
    };
  }

  // 4️⃣ Approval status check (freelancer/owner)
  if (user.role === 'freelancer') {
    const freelancer = user.freelancerReg as TFreelancerRegistration | any;

    if (!freelancer)
      throw new AppError(400, 'Your freelancer profile is incomplete.');
    if (freelancer.approvalStatus === 'pending')
      throw new AppError(403, 'Your freelancer account is under review.');
    if (freelancer.approvalStatus === 'rejected')
      throw new AppError(
        403,
        `Your freelancer account was rejected: "${freelancer.notes}"`,
      );
  }

  if (user.role === 'owner') {
    const owner = user.ownerReg as TOwnerRegistration | any;

    if (!owner)
      throw new AppError(400, 'Your salon owner profile is incomplete.');
    if (owner.approvalStatus === 'pending')
      throw new AppError(403, 'Your salon owner account is under review.');
    if (owner.approvalStatus === 'rejected')
      throw new AppError(
        403,
        `Your salon owner account was rejected: "${owner.notes}"`,
      );
  }

  let updatedUser: TUser = user;

  if (payload.fcmToken) {
    updatedUser = (await User.findOneAndUpdate(
      { email: payload.email },
      { fcmToken: payload.fcmToken?.trim() }, // trim added
      { new: true, runValidators: true },
    )) as TUser;

    console.log('FCM Token saved:', updatedUser?.fcmToken);
  }

  const tokenToUse = updatedUser?.fcmToken;

  // Send notification only if token exists AND valid
  if (tokenToUse && updatedUser?.notifications) {
    sendNotification([tokenToUse], {
      title: 'Login successfully',
      message: 'New user login to your account',
      receiver: updatedUser._id as any,
      receiverEmail: updatedUser.email,
      receiverRole: updatedUser.role,
      sender: updatedUser._id as any,
    });
  }

  // 5️⃣ Generate JWT tokens for approved accounts
  const jwtPayload: TJwtPayload = {
    userId: user._id.toString(),
    name: user.fullName,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );
  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as string,
  );

  return { accessToken, refreshToken };
};

const refreshToken = async (token: string) => {
  if (!token) {
    throw new AppError(401, 'You are not authorized! Please Login');
  }

  const decoded = verifyToken(token, config.jwt_refresh_secret as string);

  const { email, iat } = decoded;

  const user = await User.findOne({ email: email });

  if (!user) {
    throw new AppError(404, 'This user is not found!');
  }

  if (user?.isDeleted === true) {
    throw new AppError(403, 'This user account is deleted!');
  }

  if (user?.status === 'blocked') {
    throw new AppError(403, 'This user is blocked!');
  }

  // create token and sent to the client
  const jwtPayload: TJwtPayload = {
    userId: user._id.toString(),
    name: user?.fullName,
    email: user?.email,
    role: user?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );

  return {
    accessToken,
  };
};

const changePassword = async (
  userData: JwtPayload,
  payload: TChangePassword,
) => {
  const user = await User.isUserExistsByEmail(userData?.email);

  if (!user) {
    throw new AppError(404, 'This user is not found!');
  }

  if (user?.isDeleted === true) {
    throw new AppError(403, 'This user account is deleted!');
  }

  if (user?.status === 'blocked') {
    throw new AppError(403, 'This user is blocked!');
  }

  // checking if the password is correct
  const isPasswordMatched = await User.isPasswordMatched(
    payload?.oldPassword,
    user?.password,
  );
  if (!isPasswordMatched) {
    throw new AppError(403, 'Password do not matched!');
  }

  // hash new password
  const newHashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findOneAndUpdate(
    {
      _id: userData.userId,
      role: userData.role,
    },
    {
      password: newHashedPassword,
      needsPasswordChange: true,
      passwordChangeAt: new Date(),
    },
  );

  return null;
};

const forgotPassword = async (email: string) => {
  const user = await User.isUserExistsByEmail(email);

  if (!user) {
    throw new AppError(404, 'This user is not found!');
  }

  if (user?.isDeleted === true) {
    throw new AppError(403, 'This user account is deleted!');
  }

  if (user?.status === 'blocked') {
    throw new AppError(403, 'This user is blocked!');
  }

  // create token and sent to the client
  const jwtPayload: TJwtPayload = {
    userId: user._id.toString(),
    name: user?.fullName,
    email: user?.email,
    role: user?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    '2m',
  );

  const currentTime = new Date();
  const otp = generateOtp();
  const expiresAt = moment(currentTime).add(5, 'minute');
  await User.findByIdAndUpdate(user?._id, {
    verification: {
      otp,
      expiresAt,
      status: true,
      isPasswordReset: true,
    },
  });

  await sendEmail(
    email,
    'Your OTP for Password Reset',
    `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #e0e0e0;">
    <h2 style="color: #4CAF50; text-align: center; margin-top: 0;">Password Reset OTP</h2>
    
    <p style="font-size: 16px; color: #333; text-align: center;">
      We received a request to reset your password. Use the one-time password (OTP) below:
    </p>

    <div style="background-color: #f4f4f4; padding: 20px; margin: 20px auto; border-radius: 6px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
      <p style="font-size: 18px; color: #013B23; margin-bottom: 10px;">Your OTP:</p>
      <p style="font-size: 32px; color: #4CAF50; font-weight: bold; margin: 0;">${otp}</p>
    </div>

    <p style="font-size: 14px; color: #666; text-align: center; margin-top: 20px;">
      This OTP is valid until:
    </p>
    <p style="font-size: 14px; color: #013B23; text-align: center; font-weight: bold; margin: 0;">
      ${expiresAt.toLocaleString()}
    </p>

    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;" />

    <p style="font-size: 13px; color: #999; text-align: center;">
      If you did not request this, please ignore this email.
    </p>
  </div>
  `,
  );

  return { email, accessToken };
};

const resetPassword = async (token: string, payload: TResetPassword) => {
  if (!token) {
    throw new AppError(401, 'You are not authorized!');
  }

  const decoded = verifyToken(token, config.jwt_access_secret as string);

  const { userId, email } = decoded;

  const user = await User.findById({ _id: userId }).select(
    'verification isVerified',
  );

  console.log(userId);

  if (!user) {
    throw new AppError(404, 'This user is not found!');
  }

  if (user?.isDeleted === true) {
    throw new AppError(403, 'This user account is deleted!');
  }

  if (user?.status === 'blocked') {
    throw new AppError(403, 'This user is blocked!');
  }

  const verifyExpiresAt = user?.verification?.expiresAt;
  if (new Date() > verifyExpiresAt) {
    throw new AppError(400, 'otp has expired. Please resend it');
  }

  if (!user?.verification?.status) {
    throw new AppError(400, 'Otp is not verified yet!');
  }

  const hashedPassword = await bcrypt.hash(
    payload?.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const result = await User.findByIdAndUpdate(userId, {
    password: hashedPassword,
    passwordChangedAt: new Date(),
    verification: {
      otp: 0,
      status: false,
    },
  }).select('-password');

  return result;
};

const logoutUser = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'This user is not found!');
  }

  if (user?.isDeleted === true) {
    throw new AppError(403, 'This user account is deleted!');
  }

  if (user?.status === 'blocked') {
    throw new AppError(403, 'This user is blocked!');
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { fcmToken: null },
    { new: true },
  );

  const tokenToUse = updatedUser?.fcmToken;

  // Send notification only if token exists AND valid
  if (tokenToUse && updatedUser?.notifications) {
    sendNotification([tokenToUse], {
      title: 'Logout successfully',
      message: 'User logged out from your account',
      receiver: updatedUser._id as any,
      receiverEmail: updatedUser.email,
      receiverRole: updatedUser.role,
      sender: updatedUser._id as any,
      type: 'text',
    });
  }

  return null;
};

// SOCIAL LOGIN - GOOGLE LOGIN & APPLE LOGIN

const googleLogin = async (payload: any, req: Request) => {
  console.log('Google login payload___', payload);

  try {
    const decodedToken = await firebaseAdmin
      .auth()
      .verifyIdToken(payload?.token);

    if (!decodedToken) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid token');
    }

    if (!(await isValidFcmToken(payload?.fcmToken))) {
      throw new AppError(httpStatus.BAD_REQUEST, 'FCM Token is invalid');
    }

    if (!decodedToken.email_verified) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Google email is not verified',
      );
    }

    const isExistUser = await User.isUserExistsByEmail(
      decodedToken.email as string,
    );

    /* ================= EXISTING USER ================= */
    if (isExistUser) {
      if (isExistUser.isDeleted) {
        throw new AppError(403, 'This user account is deleted!');
      }

      if (isExistUser.status === 'blocked') {
        throw new AppError(403, 'This user is blocked!');
      }

      // Block non-google login attempts
      if (isExistUser.loginWth !== Login_With.google) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `This account is registered with ${isExistUser.loginWth}`,
        );
      }

      if (!isExistUser.verification?.status) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'User account is not verified',
        );
      }

      const jwtPayload: TJwtPayload = {
        userId: isExistUser._id.toString(),
        name: isExistUser.fullName,
        email: isExistUser.email,
        role: isExistUser.role,
      };

      const accessToken = createToken(
        jwtPayload,
        config.jwt_access_secret!,
        config.jwt_access_expires_in!,
      );

      const refreshToken = createToken(
        jwtPayload,
        config.jwt_refresh_secret!,
        config.jwt_refresh_expires_in!,
      );

      // Update only FCM token (no device tracking)
      await User.findByIdAndUpdate(isExistUser._id, {
        fcmToken: payload?.fcmToken,
      });

      return { user: isExistUser, accessToken, refreshToken };
    }

    /* ================= NEW USER ================= */
    const user = await User.create({
      name: decodedToken.name,
      email: decodedToken.email,
      profile: decodedToken.picture,
      phoneNumber: decodedToken.phone_number,
      role: payload?.role ?? USER_ROLE.customer,
      loginWth: Login_With.google,
      verification: { status: true },
      expireAt: null,
    });

    const jwtPayload: TJwtPayload = {
      userId: user._id.toString(),
      name: user.fullName,
      email: user.email,
      role: user.role,
    };

    const accessToken = createToken(
      jwtPayload,
      config.jwt_access_secret!,
      config.jwt_access_expires_in!,
    );

    const refreshToken = createToken(
      jwtPayload,
      config.jwt_refresh_secret!,
      config.jwt_refresh_expires_in!,
    );

    // Save FCM token for new user as well
    await User.findByIdAndUpdate(user._id, {
      fcmToken: payload?.fcmToken,
    });

    return { user, accessToken, refreshToken };
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      error?.message || 'Google login failed',
    );
  }
};

export const AuthServices = {
  loginUser,
  refreshToken,
  changePassword,
  forgotPassword,
  resetPassword,
  logoutUser,
};
