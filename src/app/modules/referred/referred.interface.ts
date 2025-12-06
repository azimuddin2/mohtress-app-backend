import { Types, Document } from 'mongoose';
import { TUser } from '../user/user.interface';

export interface IReferred extends Document {
  user: Types.ObjectId | TUser;
  referralCode: string;
  limit?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
