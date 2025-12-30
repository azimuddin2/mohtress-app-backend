import express from 'express';
import { AuthControllers } from './auth.controller';
import validateRequest from '../../middlewares/validateRequest';
import { AuthValidations } from './auth.validation';
import auth from '../../middlewares/auth';

const router = express.Router();

router.post(
  '/login',
  validateRequest(AuthValidations.loginValidationSchema),
  AuthControllers.handleLoginUser,
);

router.post(
  '/refresh-token',
  validateRequest(AuthValidations.refreshTokenValidationSchema),
  AuthControllers.handleRefreshToken,
);

router.post(
  '/change-password',
  auth('admin', 'customer', 'freelancer', 'owner'),
  validateRequest(AuthValidations.changePasswordValidationSchema),
  AuthControllers.handleChangePassword,
);

router.post(
  '/forgot-password',
  validateRequest(AuthValidations.forgotPasswordValidationSchema),
  AuthControllers.handleForgotPassword,
);

router.post(
  '/reset-password',
  validateRequest(AuthValidations.resetPasswordValidationSchema),
  AuthControllers.handleResetPassword,
);

router.put(
  '/logout',
  auth('admin', 'customer', 'freelancer', 'owner'),
  AuthControllers.logoutUser,
);

router.post('/google-login', AuthControllers.handleGoogleLogin);
router.post('/apple-login', AuthControllers.handleAppleLogin);

export const AuthRoutes = router;
