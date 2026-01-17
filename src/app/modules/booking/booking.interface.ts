import { Types } from 'mongoose';
import { TUser } from '../user/user.interface';
import { TSpecialist } from '../Specialist/Specialist.interface';

export type TBookingStatus = 'pending' | 'canceled' | 'completed';

export type TBookingRequest = 'pending' | 'approved' | 'decline';

export enum SERVICE_MODEL_TYPE {
  OwnerService = 'OwnerService',
  FreelancerService = 'FreelancerService',
}

export type TAddOnService = {
  name: string;
  qty: number;
  price: number;
};

export type TImage = {
  url: string;
  key: string;
};

export type TBooking = {
  vendor: Types.ObjectId | TUser; //Owner and Freelancer ID
  customer: Types.ObjectId | TUser;

  freelancerReg?: Types.ObjectId; // target freelancer
  ownerReg?: Types.ObjectId; // target owner

  service: Types.ObjectId;
  serviceType: SERVICE_MODEL_TYPE;

  bookingSource: 'online' | 'walkin'; // ✅ NEW
  queueNumber?: number; // ✅ NEW
  qrToken?: string; // ✅ NEW

  addOnServices: TAddOnService[];

  email: string;
  date: string;
  time: string;
  duration: string;

  specialist?: Types.ObjectId | TSpecialist;

  serviceLocation: string;
  images: TImage[];
  notes: string;
  totalPrice: number;

  status: TBookingStatus;
  dashboardStatus?: 'servicingNow' | 'nextLine' | 'upcoming';

  request: TBookingRequest;
  isPaid: boolean;

  slotStart?: number;
  slotEnd?: number;

  isDeleted: boolean;
};
