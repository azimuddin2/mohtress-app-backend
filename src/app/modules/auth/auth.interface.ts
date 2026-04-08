import { ObjectId } from 'mongoose';
import { TRole } from '../user/user.interface';

export type TLoginUser = {
  phoneOrEmail: string;
  password: string;
  fcmToken?: string;
};

export type TJwtPayload = {
  userId: ObjectId | string;
  name?: string;
  email: string;
  phone: string;
  role: TRole;
  image?: string;
  iat?: number;
  exp?: number;
};

export type TForgotPassword = {
  phoneOrEmail: string;
};

export type TChangePassword = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type TResetPassword = {
  newPassword: string;
  confirmPassword: string;
};
