import { TPaymentStatus } from './payment.interface';

export const PaymentStatus: TPaymentStatus[] = [
  'pending',
  'paid',
  'refunded',
  'cancelled',
];

export enum PAYMENT_STATUS {
  pending = 'pending',
  paid = 'paid',
  refunded = 'refunded',
  cancelled = 'cancelled',
}
