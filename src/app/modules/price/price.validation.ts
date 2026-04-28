import { z } from 'zod';

const priceValidationSchema = z.object({
  body: z.object({
    price: z.number({
      required_error: 'Price is required',
    }),
  }),
});

export const PriceValidation = {
  priceValidationSchema,
};
