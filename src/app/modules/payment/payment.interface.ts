import { Types } from 'mongoose';
import { TUser } from '../user/user.interface';
import { TBooking } from '../booking/booking.interface';

export type TPaymentStatus = 'pending' | 'paid' | 'refunded' | 'cancelled';
export type TPaymentType = 'deposit'; // future: 'full', 'withdrawal'

export type TPayment = {
  user: Types.ObjectId | TUser; // customer
  vendor: Types.ObjectId | TUser; // stylist

  booking: Types.ObjectId | TBooking;

  type: TPaymentType; // deposit only (MVP)

  status: TPaymentStatus;

  trnId: string;

  // Amounts
  price: number; // total deposit (ex: 10)
  adminAmount: number; // MohTress fee (ex: 5)
  vendorAmount: number; // stylist amount (ex: 5)

  // Stripe
  paymentIntentId?: string; // optional (after success)
  stripeSessionId?: string; // optional (recommended)

  isPaid: boolean;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};
