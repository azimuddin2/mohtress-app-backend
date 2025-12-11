import { z } from 'zod';

const createMemberValidationSchema = z.object({
  body: z.object({
    firstName: z.string({
      required_error: 'First name is required',
    }),

    lastName: z.string({
      required_error: 'Last name is required',
    }),

    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),

    phone: z.string({ required_error: 'Phone number is required' }),

    role: z
      .string({
        required_error: 'Role is required',
      })
      .optional(),
  }),
});

const updateMemberValidationSchema = z.object({
  body: z.object({
    firstName: z
      .string({
        required_error: 'First name is required',
      })
      .optional(),

    lastName: z
      .string({
        required_error: 'Last name is required',
      })
      .optional(),

    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .optional(),

    phone: z.string({ required_error: 'Phone number is required' }).optional(),

    role: z
      .string({
        required_error: 'Role is required',
      })
      .optional(),
  }),
});

export const MemberValidations = {
  createMemberValidationSchema,
  updateMemberValidationSchema,
};
