import { TBookingRequest, TBookingStatus } from './booking.interface';

export const BookingStatus: TBookingStatus[] = [
  'pending',
  'in-process',
  'completed',
  'canceled',
];

export const BookingRequest: TBookingRequest[] = [
  'pending',
  'approved',
  'decline',
];

// export const PaymentStatus: TPaymentStatus[] = [
//   'pending',
//   'paid',
//   'refunded',
//   'failed',
// ];

export const bookingSearchableFields = [
  'name',
  'email',
  'phone',
  'status',
  'serviceName',
];
