import { Types } from 'mongoose';

export interface INotification {
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  receiverEmail: string;
  receiverRole: string;
  message: string;
  fcmToken?: string;
  type?: 'text' | 'reminder' | 'payment' | 'booking';
  title?: string;
  isRead?: boolean;
  link?: string;
}
