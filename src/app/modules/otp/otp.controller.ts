import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { OtpServices } from './otp.service';

const handleSendOtp = catchAsync(async (req, res) => {
  // const userId = req.params.userId;
  // const method = req.body.method as 'email' | 'phone';

  const { userId, method } = req.body;

  const result = await OtpServices.sendOtp(userId, method);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

const handleVerifyOtp = catchAsync(async (req, res) => {
  const token = req?.headers?.authorization as string;
  const otp = req.body.otp;

  const result = await OtpServices.verifyOtp(token, otp);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Account verified successfully',
    data: result,
  });
});

export const OtpControllers = {
  handleSendOtp,
  handleVerifyOtp,
};
