import { z } from 'zod';

const loginValidationSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required',
      })
      .email('Invalid email address'),

    password: z.string({
      required_error: 'Password is required',
    }),
  }),
});

export const refreshTokenValidationSchema = z.object({
  body: z.object({
    refreshToken: z.string({
      required_error: 'Refresh token is required!',
    }),
  }),
});

export const changePasswordValidationSchema = z.object({
  body: z
    .object({
      oldPassword: z.string({
        required_error: 'Old password is required',
      }),

      newPassword: z
        .string({
          required_error: 'New password is required',
        })
        .min(8, 'New Password must be at least 8 characters')
        .regex(
          /[a-z]/,
          'New Password must contain at least one lowercase letter',
        )
        .regex(
          /[A-Z]/,
          'New Password must contain at least one uppercase letter',
        )
        .regex(/[0-9]/, 'New Password must contain at least one number')
        .regex(
          /[!@#$%^&*]/,
          'New Password must contain at least one special character',
        ),

      confirmPassword: z.string({
        required_error: 'Confirm password is required',
      }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'NewPassword & ConfirmPassword do not match',
      path: ['confirmPassword'],
    }),
});

const forgotPasswordValidationSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email or phone is required',
      })
      .email('Invalid email address')
      .optional(),
    phone: z
      .string({
        required_error: 'Email or phone is required',
      })
      .optional(),
  }),
});

export const resetPasswordValidationSchema = z.object({
  body: z
    .object({
      newPassword: z
        .string({
          required_error: 'New password is required',
        })
        .min(8, 'New Password must be at least 8 characters')
        .regex(
          /[a-z]/,
          'New Password must contain at least one lowercase letter',
        )
        .regex(
          /[A-Z]/,
          'New Password must contain at least one uppercase letter',
        )
        .regex(/[0-9]/, 'New Password must contain at least one number')
        .regex(
          /[!@#$%^&*]/,
          'New Password must contain at least one special character',
        ),

      confirmPassword: z.string({
        required_error: 'Confirm password is required',
      }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'NewPassword & ConfirmPassword do not match',
      path: ['confirmPassword'],
    }),
});

export const AuthValidations = {
  loginValidationSchema,
  refreshTokenValidationSchema,
  changePasswordValidationSchema,
  forgotPasswordValidationSchema,
  resetPasswordValidationSchema,
};
