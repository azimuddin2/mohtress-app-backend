import { Model, ObjectId, Types } from 'mongoose';
import { USER_ROLE } from './user.constant';
import { TOwnerRegistration } from '../ownerRegistration/ownerRegistration.interface';
import { TFreelancerRegistration } from '../freelancerRegistration/freelancerRegistration.interface';

export type TRole = 'customer' | 'owner' | 'freelancer' | 'admin' | 'sub-admin';

export type TStatus = 'ongoing' | 'confirmed' | 'blocked';

export type TGender = 'male' | 'female' | 'other';

export type TUser = {
  save(): unknown;
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
  salonAffiliated?: string;
  role: TRole;
  status: TStatus;
  image: string | null;
  isDeleted: boolean;
  isVerified: boolean;
  verificationMethod: 'email' | 'phone' | null;
  verification: {
    otp: string | number | null;
    expiresAt: Date | null;
    status: boolean;
  };

  loginWith: 'google' | 'apple' | 'credentials';

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
  stripeOnboardingComplete?: boolean;

  // Referral
  referralCode?: string;
  referredBy?: string | Types.ObjectId;
  referralCount?: number;
  referralEarnings?: number;
  isReferral?: boolean;
};

export interface UserModel extends Model<TUser> {
  isUserExistsByEmail(email: string): Promise<TUser>;
  isUserExistsByPhone(phone: string): Promise<TUser>;

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
