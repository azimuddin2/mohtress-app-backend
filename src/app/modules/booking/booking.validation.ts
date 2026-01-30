import { z } from 'zod';
import { SERVICE_MODEL_TYPE } from './booking.interface';
import { BookingRequest, BookingStatus } from './booking.constant';

const addOnServiceSchema = z.object({
  name: z.string().min(1, 'Add-on service name is required'),
  qty: z.number().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be a positive number'),
});

const createBookingValidationSchema = z.object({
  body: z.object({
    vendor: z.string().min(1, 'Vendor is required'),
    customer: z.string().min(1, 'Customer is required').optional(),
    customerName: z.string().min(1, 'Customer name is required'),

    service: z.string().min(1, 'Service is required'),
    serviceType: z.enum([
      SERVICE_MODEL_TYPE.OwnerService,
      SERVICE_MODEL_TYPE.FreelancerService,
    ]),

    addOnServices: z.array(addOnServiceSchema).optional(),

    email: z.string().email('Invalid email format').optional(),

    date: z.string().min(1, 'Date is required'),
    time: z.string().min(1, 'Time is required'),

    specialist: z.string().optional(),

    serviceLocation: z.string().min(1, 'Service location is required'),

    notes: z.string().min(1, 'Notes is required').optional(),

    totalPrice: z.number().min(0, 'Total price must be a positive number'),

    isDeleted: z.boolean().optional(),
  }),
});

const updateBookingStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum([...BookingStatus] as [string, ...string[]]),
  }),
});

const updateBookingRequestValidationSchema = z.object({
  body: z.object({
    request: z.enum([...BookingRequest] as [string, ...string[]]),
  }),
});

export const BookingValidation = {
  createBookingValidationSchema,
  updateBookingStatusValidationSchema,
  updateBookingRequestValidationSchema,
};
