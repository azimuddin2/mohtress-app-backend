import { z } from 'zod';

const sendOtpValidationSchema = z.object({
  body: z.object({
    userId: z.string({
      required_error: 'User ID is required',
    }),
    method: z.enum(['email', 'phone'], {
      required_error: 'Method is required',
    }),
  }),
});

const verifyOtpValidationSchema = z.object({
  body: z.object({
    userId: z.string({
      required_error: 'User ID is required',
    }),
    otp: z
      .string({
        required_error: 'OTP is required',
      })
      .min(4, 'OTP must be at least 6 digits')
      .regex(/^\d+$/, 'OTP must contain only numbers'),
  }),
});

export const OtpValidations = {
  verifyOtpValidationSchema,
  sendOtpValidationSchema,
};
