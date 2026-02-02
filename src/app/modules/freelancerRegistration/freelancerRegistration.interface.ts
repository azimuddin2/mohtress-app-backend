import { ObjectId, Types } from 'mongoose';
import { TUser } from '../user/user.interface';
import { TFreelancerService } from '../freelancerService/freelancerService.interface';

export type TApprovalStatus = 'pending' | 'approved' | 'rejected';

export type TFreelancerRegistration = {
  user: ObjectId | TUser;
  profile: string;
  experienceYear: number;
  about: string;

  idDocument: string;
  businessRegistration?: string;

  openingHours: {
    enabled: boolean;
    day: string;
    openTime: string; // e.g. "09:00"
    closeTime: string; // e.g. "18:00"
  }[];

  approvalStatus: TApprovalStatus;
  notes: string;
  availability: string[];

  salonPhoto: string | null;
  name: string;
  businessRegistrationNumber: number;

  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    streetAddress?: string;
  };

  city: string;
  postalCode: number;
  country: string;

  services: Types.ObjectId[] | TFreelancerService[];

  reviews?: Types.ObjectId[];
  avgRating?: number;

  isDeleted: boolean;
};
