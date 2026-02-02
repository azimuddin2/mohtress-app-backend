import { ObjectId, Types } from 'mongoose';
import { TUser } from '../user/user.interface';
import { TOwnerService } from '../ownerService/ownerService.interface';

export type TApprovalStatus = 'pending' | 'approved' | 'rejected';

export type TOwnerRegistration = {
  user: ObjectId | TUser;
  salonName: string;
  about: string;
  idDocument: string;
  businessRegistration: string;
  salonFrontPhoto: string;
  salonInsidePhoto: string;
  openingHours: {
    enabled: boolean;
    day: string;
    openTime: string; // e.g. "09:00"
    closeTime: string; // e.g. "18:00"
  }[];

  approvalStatus: TApprovalStatus;
  notes: string;

  salonPhoto?: string | null;
  businessRegistrationNumber?: number;

  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    streetAddress?: string;
  };

  services: Types.ObjectId[] | TOwnerService[];
  reviews: Types.ObjectId[];
  avgRating?: number;

  qrToken?: string;

  isDeleted: boolean;
};
