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

export const bookingSearchableFields = [
  'email',
  'customerName',
  'date',
  'time',
  'status',
  'request',
];
