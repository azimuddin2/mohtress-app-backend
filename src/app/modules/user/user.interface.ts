import { Model, ObjectId, Types } from 'mongoose';
import { USER_ROLE } from './user.constant';
import { TOwnerRegistration } from '../ownerRegistration/ownerRegistration.interface';
import { TFreelancerRegistration } from '../freelancerRegistration/freelancerRegistration.interface';

export type TRole = 'customer' | 'owner' | 'freelancer' | 'admin' | 'sub-admin';

export type TStatus = 'ongoing' | 'confirmed' | 'blocked';

export type TGender = 'male' | 'female' | 'other';

export type TUser = {
  _id: ObjectId;
  fullName: string;
  phone: string;
  email: string;
  streetAddress: string;
  zipCode: string;
  city: string;
  state: string;
  password: string;
  needsPasswordChange: boolean;
  passwordChangeAt?: Date;
  gender?: TGender;
  selectSalon?: string;
  role: TRole;
  status: TStatus;
  image: string | null;
  isDeleted: boolean;
  isVerified: boolean;
  verification: {
    otp: string | number;
    expiresAt: Date;
    status: boolean;
  };

  loginWth: 'google' | 'apple' | 'credentials';

  isRegistration: boolean;
  freelancerReg?: Types.ObjectId | TOwnerRegistration;
  ownerReg?: Types.ObjectId | TFreelancerRegistration;

  fcmToken?: string;
  notifications: boolean;

  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    streetAddress?: string;
  };

  // 🔹 Stripe (Customer)
  stripeCustomerId?: string;

  // 🔹 Stripe (Vendor / Connect)
  stripeAccountId?: string;

  // Referral
  referralCode?: string;
  isReferral?: boolean;
  referredBy?: string;
};

export interface UserModel extends Model<TUser> {
  isUserExistsByEmail(email: string): Promise<TUser>;

  isPasswordMatched(
    plainTextPassword: string,
    hashPassword: string,
  ): Promise<boolean>;

  isJWTIssuedBeforePasswordChanged(
    passwordChangedTimestamp: Date,
    jwtIssuedTimestamp: number,
  ): boolean;
}

export type TUserRole = keyof typeof USER_ROLE;
