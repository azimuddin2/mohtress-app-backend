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
import { createToken, isValidFcmToken, verifyAppleToken } from './auth.utils';
import { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { generateOtp } from '../../utils/generateOtp';
import moment from 'moment';
import { sendEmail } from '../../utils/sendEmail';
import { TFreelancerRegistration } from '../freelancerRegistration/freelancerRegistration.interface';
import { TOwnerRegistration } from '../ownerRegistration/ownerRegistration.interface';
import { TUser } from '../user/user.interface';
import { sendNotification } from '../notification/notification.utils';
import httpStatus from 'http-status';
import { Login_With, USER_ROLE } from '../user/user.constant';
import admin from '../../utils/firebase';

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

  const otp = generateOtp();

  const otpExpiryMinutes = 5; // OTP valid 5 minutes
  const expiresAt = moment().add(otpExpiryMinutes, 'minutes').toDate();

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
     <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; padding:40px; border-radius:8px; box-shadow:0 0 10px rgba(0,0,0,0.05); max-width:600px; width:100%;">
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <h2 style="color:#4625A0; margin:0;">Reset Your Password</h2>
            </td>
          </tr>
          <tr>
            <td style="font-size:16px; color:#333333; padding-bottom:20px; text-align:center;">
              <p style="margin:0;">Use the OTP below to reset your password. Do not share this code with anyone.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 0;">
              <div style="display:inline-block; padding:15px 30px; font-size:24px; font-weight:bold; color:#ffffff; background-color:#4625A0; border-radius:6px; letter-spacing:2px;">
                ${otp}
              </div>
            </td>
          </tr>
          <tr>
            <td style="font-size:14px; color:#666666; text-align:center; padding-bottom:20px;">
              <p style="margin:0;">This OTP is valid for <strong>${otpExpiryMinutes} minutes</strong> (expires at <strong>${expiresAt.toLocaleTimeString()}</strong>).</p>
            </td>
          </tr>
          <tr>
            <td style="font-size:13px; color:#999999; text-align:center;">
              <p style="margin:0;">If you did not request a password reset, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:30px; text-align:center;">
              <p style="font-size:12px; color:#cccccc; margin:0;">&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
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

  const verifyExpiresAt = user?.verification?.expiresAt as Date;
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

// SOCIAL LOGIN METHODS GOOGLE & APPLE
const googleLogin = async (payload: any) => {
  try {
    console.log('Google Token:', payload.token);

    if (!payload?.token) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Token is required');
    }

    const decodedToken = await admin.auth().verifyIdToken(payload.token);
    console.log('Decoded Google Token:', decodedToken);

    if (!decodedToken?.email) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Google token');
    }

    if (!decodedToken.email_verified) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Google email is not verified',
      );
    }

    /* ================= FCM TOKEN VALIDATION ================= */
    if (payload?.fcmToken) {
      const isValid = await isValidFcmToken(payload.fcmToken);
      if (!isValid) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid FCM token');
      }
    }

    /* ================= CHECK USER EXISTS ================= */
    const existingUser = await User.isUserExistsByEmail(decodedToken.email);

    /* =============== EXISTING USER LOGIN ================== */
    if (existingUser) {
      if (existingUser.isDeleted) {
        throw new AppError(httpStatus.FORBIDDEN, 'User account is deleted');
      }

      if (existingUser.status === 'blocked') {
        throw new AppError(httpStatus.FORBIDDEN, 'User is blocked');
      }

      if (existingUser.loginWith !== Login_With.google) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `Account registered with ${existingUser.loginWith}`,
        );
      }

      if (!existingUser.verification?.status) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'User account is not verified',
        );
      }

      /* ================= CREATE JWT ================= */
      const jwtPayload: TJwtPayload = {
        userId: existingUser._id.toString(),
        email: existingUser.email,
        role: existingUser.role,
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

      /* ================= UPDATE FCM TOKEN ================= */
      if (payload?.fcmToken) {
        await User.findByIdAndUpdate(existingUser._id, {
          fcmToken: payload.fcmToken,
        });
      }

      return {
        user: existingUser,
        accessToken,
        refreshToken,
      };
    }

    /* ================== NEW USER CREATE ==================== */
    const newUser = await User.create({
      fullName: decodedToken.name || 'Google User',
      email: decodedToken.email,
      phone: 'N/A',

      streetAddress: 'N/A',
      city: 'N/A',
      state: 'N/A',
      zipCode: 'N/A',

      password: 'GOOGLE_LOGIN_NO_PASSWORD',
      role: USER_ROLE.customer,
      loginWth: Login_With.google,

      isVerified: true,
      verification: { status: true },

      image: decodedToken.picture || null,
      fcmToken: payload?.fcmToken || null,
    });

    /* ================= CREATE JWT FOR NEW USER ================= */
    const jwtPayload: TJwtPayload = {
      userId: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
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

    return {
      user: newUser,
      accessToken,
      refreshToken,
    };
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      error?.message || 'Google login failed',
    );
  }
};

const appleLogin = async (payload: any) => {
  try {
    if (!payload?.token) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Token is required');
    }

    /* ================= VERIFY APPLE TOKEN ================= */
    const decodedToken: any = await verifyAppleToken(payload.token);

    if (!decodedToken?.sub) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Apple token');
    }

    // ⚠️ Apple email only first login
    const email =
      decodedToken.email || payload?.email || `${decodedToken.sub}@apple.com`;

    /* ================= FCM TOKEN VALIDATION ================= */
    if (payload?.fcmToken) {
      const isValid = await isValidFcmToken(payload.fcmToken);
      if (!isValid) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid FCM token');
      }
    }

    /* ================= CHECK USER EXISTS ================= */
    const existingUser = await User.isUserExistsByEmail(email);

    /* =============== EXISTING USER LOGIN ================== */
    if (existingUser) {
      if (existingUser.isDeleted) {
        throw new AppError(httpStatus.FORBIDDEN, 'User account is deleted');
      }

      if (existingUser.status === 'blocked') {
        throw new AppError(httpStatus.FORBIDDEN, 'User is blocked');
      }

      if (existingUser.loginWith !== Login_With.apple) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `Account registered with ${existingUser.loginWith}`,
        );
      }

      if (!existingUser.verification?.status) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'User account is not verified',
        );
      }

      /* ================= CREATE JWT ================= */
      const jwtPayload: TJwtPayload = {
        userId: existingUser._id.toString(),
        email: existingUser.email,
        role: existingUser.role,
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

      if (payload?.fcmToken) {
        await User.findByIdAndUpdate(existingUser._id, {
          fcmToken: payload.fcmToken,
        });
      }

      return { user: existingUser, accessToken, refreshToken };
    }

    /* ================= NEW USER CREATE ================= */
    const newUser = await User.create({
      fullName: payload?.fullName || 'Apple User',
      email,
      phone: 'N/A',

      streetAddress: 'N/A',
      city: 'N/A',
      state: 'N/A',
      zipCode: 'N/A',

      password: 'APPLE_LOGIN_NO_PASSWORD',
      role: USER_ROLE.customer,
      loginWth: Login_With.apple,

      isVerified: true,
      verification: { status: true },

      image: null,
      fcmToken: payload?.fcmToken || null,
    });

    /* ================= CREATE JWT FOR NEW USER ================= */
    const jwtPayload: TJwtPayload = {
      userId: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
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

    return { user: newUser, accessToken, refreshToken };
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      error?.message || 'Apple login failed',
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
  googleLogin,
  appleLogin,
};
