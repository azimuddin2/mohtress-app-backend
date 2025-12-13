import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from './auth.service';

const handleLoginUser = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUser(req.body);
  const { accessToken, refreshToken } = result;

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User is logged in successfully!',
    data: { accessToken, refreshToken },
  });
});

const handleRefreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await AuthServices.refreshToken(refreshToken);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Access token is retrieved successfully!',
    data: result,
  });
});

const handleChangePassword = catchAsync(async (req, res) => {
  const result = await AuthServices.changePassword(req.user, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Password is updated successfully!',
    data: result,
  });
});

const handleForgotPassword = catchAsync(async (req, res) => {
  const email = req.body.email;
  const result = await AuthServices.forgotPassword(email);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'An OTP has been sent to your email address.',
    data: result,
  });
});

const handleResetPassword = catchAsync(async (req, res) => {
  const token = req?.headers?.authorization as string;
  const result = await AuthServices.resetPassword(token, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Your password has been updated successfully.',
    data: result,
  });
});

const logoutUser = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const result = await AuthServices.logoutUser(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User logged out successfully',
    data: result,
  });
});

export const AuthControllers = {
  handleLoginUser,
  handleRefreshToken,
  handleChangePassword,
  handleForgotPassword,
  handleResetPassword,
  logoutUser,
};
