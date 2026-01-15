import express from 'express';
import { OtpControllers } from './otp.controller';
import validateRequest from '../../middlewares/validateRequest';
import { OtpValidations } from './otp.validation';

const router = express.Router();

router.post(
  '/send-otp',
  validateRequest(OtpValidations.sendOtpValidationSchema),
  OtpControllers.handleSendOtp,
);

router.post(
  '/resend-otp',
  validateRequest(OtpValidations.sendOtpValidationSchema),
  OtpControllers.handleRendOtp,
);

router.post(
  '/verify-otp',
  validateRequest(OtpValidations.verifyOtpValidationSchema),
  OtpControllers.handleVerifyOtp,
);

export const OtpRoutes = router;
