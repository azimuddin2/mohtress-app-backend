import moment from 'moment';
import config from '../../config';
import AppError from '../../errors/AppError';
import { verifyToken } from '../../utils/verifyToken';
import { User } from '../user/user.model';
import { TJwtPayload } from '../auth/auth.interface';
import { TVerifyOtp } from './otp.interface';
import { createToken } from '../auth/auth.utils';
import { generateOtp } from '../../utils/generateOtp';
import jwt, { Secret } from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { sendEmail } from '../../utils/sendEmail';
import { sendPhoneOTP } from '../../helpers/twilio.helper';

const sendOtp = async (userId: string, method: 'email' | 'phone') => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found!');
  }

  if (method === 'email' && !user.email) {
    throw new AppError(400, 'User has no email to send OTP.');
  }

  if (method === 'phone' && !user.phone) {
    throw new AppError(400, 'User has no phone to send OTP.');
  }

  const otp = generateOtp();
  const expiresAt = moment().add(3, 'minutes').toDate();

  if (method === 'email') {
    user.verification = { otp, expiresAt, status: false };
    user.verificationMethod = 'email';
    await user.save();

    await sendEmail(
      user.email,
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
  } else if (method === 'phone') {
    // Twilio handles OTP
    user.verification = { otp: '', expiresAt, status: false };
    user.verificationMethod = 'phone';
    await user.save();

    await sendPhoneOTP(user.phone!);
  }

  return { message: `OTP sent via ${method}` };
};

const verifyOtp = async (token: string, otp: TVerifyOtp) => {
  if (!token) {
    throw new AppError(401, 'You are not authorized! Please Login.');
  }

  const decoded = verifyToken(token, config.jwt_access_secret as string);

  const { email } = decoded;

  const user = await User.findOne({ email: email }).select(
    'verification isVerified role email',
  );

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
    throw new AppError(400, 'Otp has expired. Please resend it');
  }

  const verifyOtpCode = Number(user?.verification?.otp);
  if (Number(otp) !== verifyOtpCode) {
    throw new AppError(400, 'Otp did not match');
  }

  await User.findByIdAndUpdate(
    user?._id,
    {
      $set: {
        isVerified: user?.isVerified === false ? true : user?.isVerified,
        verification: {
          otp: 0,
          expiresAt: moment().add(3, 'minute'),
          status: true,
        },
      },
    },
    { new: true },
  );

  // create token and sent to the client
  const jwtPayload: TJwtPayload = {
    userId: user._id.toString(),
    email: user?.email,
    role: user?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );

  return { token: accessToken };
};

const resendOtp = async (email: string) => {
  const user = await User.findOne({ email }).select(
    '_id email name verification',
  );

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Optional: prevent resending if already verified
  if (user.verification?.status === true) {
    throw new AppError(400, 'Account already verified');
  }

  const otp = generateOtp();
  const expiresAt = moment().add(3, 'minutes').toDate();

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      verification: {
        otp,
        expiresAt,
        status: false,
      },
    },
    { new: true },
  );

  if (!updatedUser) {
    throw new AppError(500, 'Failed to resend OTP');
  }

  const token = jwt.sign(
    {
      email: user.email,
      userId: user._id,
    },
    config.jwt_access_secret as Secret,
    { expiresIn: '3m' },
  );

  const otpEmailPath = path.join(process.cwd(), 'public/view/otp_mail.html');

  const emailTemplate = fs
    .readFileSync(otpEmailPath, 'utf8')
    .replace('{{fullName}}', user.fullName)
    .replace('{{otpCode}}', otp)
    .replace('{{email}}', user.email)
    .replace(
      '{{verifyUrl}}',
      `${config.server_url}/otp/verify-link?token=${token}`,
    );

  await sendEmail(user.email, 'Your One Time OTP', emailTemplate);

  return {
    token,
    expiresIn: '3 minutes',
  };
};

export const OtpServices = {
  sendOtp,
  verifyOtp,
  resendOtp,
};
