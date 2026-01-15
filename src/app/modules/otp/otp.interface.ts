import { ObjectId } from 'mongoose';
import { TUser } from '../user/user.interface';

export type TSendOtp = {
  userId: string | ObjectId | TUser;
  method: 'email' | 'phone';
};

export type TVerifyOtp = {
  userId: string | ObjectId | TUser;
  otp: string;
};
