import moment from 'moment';
import config from '../../config';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { TJwtPayload } from '../auth/auth.interface';
import { TSendOtp, TVerifyOtp } from './otp.interface';
import { createToken } from '../auth/auth.utils';
import { generateOtp } from '../../utils/generateOtp';
import { sendEmail } from '../../utils/sendEmail';
import { sendPhoneOTP, verifyPhoneOTP } from '../../helpers/twilio.helper';

const sendOtp = async (payload: TSendOtp) => {
  const { userId, method } = payload;

  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');

  const otpExpiryMinutes = 5; // OTP valid 5 minutes
  const expiresAt = moment().add(otpExpiryMinutes, 'minutes').toDate();

  if (method === 'email') {
    if (!user.email) throw new AppError(400, 'Email missing');

    const otp = generateOtp();

    // Save OTP to DB
    user.verification = { otp, expiresAt, status: false };
    user.verificationMethod = 'email';
    await user.save();

    // Send Email with expiry time
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
                    <h2 style="color: #4625A0; margin: 0;">Verify Your Email</h2>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 16px; color: #333333; padding-bottom: 20px; text-align: center;">
                    <p style="margin: 0;">Use the OTP below to verify your email address and complete your registration:</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <div style="display: inline-block; padding: 15px 30px; font-size: 24px; font-weight: bold; color: #ffffff; background-color: #4625A0; border-radius: 6px; letter-spacing: 2px;">
                      ${otp}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #666666; text-align: center; padding-bottom: 20px;">
                    <p style="margin: 0;">
                      This code is valid for <strong>${otpExpiryMinutes} minutes</strong> 
                      (expires at <strong>${expiresAt.toLocaleTimeString()}</strong>).
                    </p>
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
  }

  if (method === 'phone') {
    if (!user.phone) throw new AppError(400, 'Phone missing');

    user.verificationMethod = 'phone';
    await user.save();

    // Twilio Verify (no DB OTP needed)
    await sendPhoneOTP(user.phone);
  }

  return { message: `OTP sent via ${method}`, userId: user._id };
};

const resendOtp = async (payload: TSendOtp) => {
  const { userId, method } = payload;

  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');
  if (user.isDeleted) throw new AppError(403, 'Account deleted');
  if (user.status === 'blocked') throw new AppError(403, 'Account blocked');
  if (user.isVerified) throw new AppError(400, 'Account already verified');

  // Generate new OTP
  const otp = generateOtp();
  const expiresAt = moment().add(5, 'minutes').toDate();

  if (method === 'email') {
    if (!user.email) throw new AppError(400, 'Email missing');

    user.verification = { otp, expiresAt, status: false };
    user.verificationMethod = 'email';
    await user.save();

    await sendEmail(
      user.email,
      'Your OTP Code for Email Verification',
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Email Verification OTP</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 30px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <h2 style="color: #4625A0; margin: 0;">Email Verification</h2>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 16px; color: #333333; padding-bottom: 20px; text-align: center;">
                    <p style="margin: 0;">Hello <strong>${user.fullName}</strong>,</p>
                    <p style="margin: 5px 0 0;">Use the OTP below to verify your email and complete your registration:</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <div style="display: inline-block; padding: 15px 30px; font-size: 24px; font-weight: bold; color: #ffffff; background-color: #4625A0; border-radius: 6px; letter-spacing: 2px;">
                      ${otp}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #666666; text-align: center; padding-bottom: 20px;">
                    <p style="margin: 0;">This OTP is valid for <strong>5 minutes</strong> (expires at <strong>${expiresAt.toLocaleTimeString()}</strong>).</p>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #999999; text-align: center;">
                    <p style="margin: 0;">If you did not request this OTP, please ignore this email. No action is required.</p>
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
  }

  if (method === 'phone') {
    if (!user.phone) throw new AppError(400, 'Phone missing');

    user.verificationMethod = 'phone';
    await user.save();

    await sendPhoneOTP(user.phone);
  }

  return { message: `OTP resent via ${method}`, userId: user._id };
};

const verifyOtp = async (payload: TVerifyOtp) => {
  const { userId, otp } = payload;

  const user = await User.findById(userId).select(
    '+verification +verificationMethod',
  );
  if (!user) throw new AppError(404, 'User not found');
  if (user.isDeleted) throw new AppError(403, 'Account deleted');
  if (user.status === 'blocked') throw new AppError(403, 'Account blocked');

  const method = user.verificationMethod;
  if (!method) throw new AppError(400, 'No verification requested');

  // ------------ EMAIL OTP ------------
  if (method === 'email') {
    const verification = user.verification;

    if (!verification || verification.otp == null) {
      throw new AppError(400, 'OTP not found');
    }

    if (moment().isAfter(verification.expiresAt!)) {
      throw new AppError(400, 'OTP expired');
    }

    if (String(otp) !== String(verification.otp)) {
      throw new AppError(400, 'Invalid OTP');
    }
  }

  // --------- PHONE OTP via Twilio ---------
  if (method === 'phone') {
    if (!user.phone) throw new AppError(400, 'Phone missing');
    const result = await verifyPhoneOTP(user.phone, otp); // Twilio verification
    if (!result.success) throw new AppError(400, 'Invalid or expired OTP');
  }

  // --------- VERIFIED SUCCESSFULLY ---------
  user.isVerified = true;
  user.verification = {
    otp: null,
    expiresAt: null,
    status: true,
  };
  user.verificationMethod = null;
  await user.save();

  // ---------- JWT CREATION ----------
  const jwtPayload: TJwtPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret!,
    config.jwt_access_expires_in!,
  );

  return { accessToken };
};

export const OtpServices = {
  sendOtp,
  verifyOtp,
  resendOtp,
};
