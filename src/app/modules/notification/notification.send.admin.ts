import { Types } from 'mongoose';
import { User } from '../user/user.model';
import { sendNotification } from './notification.utils';

export interface IAdminSendNotificationPayload {
  sender: Types.ObjectId;
  type?: 'text' | 'reminder' | 'payment' | 'booking';
  title: string;
  message: string;
  link?: string;
}

export const sendAdminNotifications = async (
  payload: IAdminSendNotificationPayload,
) => {
  console.log('payload', payload);

  const admin = await User.findOne({
    role: 'admin',
    isDeleted: false,
  }).select('fcmToken email _id');

  if (admin?.fcmToken) {
    sendNotification([admin.fcmToken], {
      sender: payload.sender,
      receiver: admin?._id as any,
      receiverEmail: admin?.email,
      receiverRole: 'admin',
      title: payload.title,
      message: payload.message,
      type: payload.type as any,
      link: payload.link,
    });
  }
};
