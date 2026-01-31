import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { OtpServices } from './otp.service';

const handleSendOtp = catchAsync(async (req, res) => {
  const result = await OtpServices.sendOtp(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: { userId: result.userId },
  });
});

const handleRendOtp = catchAsync(async (req, res) => {
  const result = await OtpServices.resendOtp(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: { userId: result.userId },
  });
});

const handleVerifyOtp = catchAsync(async (req, res) => {
  const result = await OtpServices.verifyOtp(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Account verified successfully',
    data: result,
  });
});

const handleAdminVerifyOtp = catchAsync(async (req, res) => {
  const token = req?.headers?.authorization as string;
  const otp = req.body.otp;

  const result = await OtpServices.AdminVerifyOtp(token, otp);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Account verified successfully',
    data: result,
  });
});

export const OtpControllers = {
  handleSendOtp,
  handleRendOtp,
  handleVerifyOtp,
  handleAdminVerifyOtp,
};
