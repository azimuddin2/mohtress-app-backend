import { TBookingRequest, TBookingStatus } from './booking.interface';

export const BookingStatus: TBookingStatus[] = [
  'pending',
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
  'email',
  'customer.fullName',
  'vendor.fullName',
  'service.name',
];
