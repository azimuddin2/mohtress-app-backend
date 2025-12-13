import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import { sendEmail } from '../../utils/sendEmail';
import Notification from './notification.model';
import AppError from '../../errors/AppError';

const getNotificationFromDB = async (query: Record<string, any>) => {
  const { receiver, type } = query;

  if (!receiver || !mongoose.Types.ObjectId.isValid(receiver as string)) {
    throw new AppError(400, 'Invalid Receiver ID');
  }

  const notificationQuery: any = { isRead: false, receiver };

  // type filter
  if (type) {
    notificationQuery.type = type;
  }

  const queryModel = new QueryBuilder(
    Notification.find(notificationQuery),
    query,
  )
    .filter()
    .sort()
    .fields()
    .paginate();

  const data: any = await queryModel.modelQuery;
  const meta = await queryModel.countTotal();

  return {
    meta,
    data,
  };
};

const makeMeReadNotification = async (id: string, user: string) => {
  const result = await Notification.findOneAndUpdate(
    { _id: id, receiver: user },
    { isRead: true },
    {
      new: true,
    },
  );
  return result;
};

const makeReadAllNotification = async (user: string) => {
  const result = await Notification.updateMany(
    { receiver: user, isRead: true },
    {
      new: true,
    },
  );
  return result;
};

const getAdminAllNotification = async (query: Record<string, any>) => {
  const baseQuery = Notification.find();
  const notificationQuery = new QueryBuilder(baseQuery, query)
    .filter()
    .sort()
    .fields()
    .paginate();

  const data: any = await notificationQuery.modelQuery;
  const meta = await notificationQuery.countTotal();

  return {
    meta,
    data,
  };
};

const pushNotificationUser = async (payload: any, role: string) => {
  const htmlContent = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
      
      <!-- Header -->
      <div style="background-color: #165940; color: #ffffff; padding: 24px 32px;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 600;">
          ${payload.title}
        </h1>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">
          Notification from ${role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User'}
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 32px;">
        <p style="font-size: 16px; color: #333; line-height: 1.6;">
          ${payload.message}
        </p>

        <div style="margin-top: 24px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
          <p style="margin: 0; font-size: 15px; color: #444;">
            <strong>Date:</strong> ${payload.date}
          </p>
          <p style="margin: 4px 0 0; font-size: 15px; color: #444;">
            <strong>Time:</strong> ${payload.time}
          </p>
        </div>

        <p style="margin-top: 32px; font-size: 13px; color: #777;">
          This is an automated system notification — please do not reply to this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #165940; color: #ffffff; text-align: center; padding: 16px; font-size: 13px;">
        <p style="margin: 0;">© ${new Date().getFullYear()} The Reflective Spirit</p>
      </div>
    </div>
  </div>
  `;

  await sendEmail(payload.email, payload.title, htmlContent);
};

export const NotificationServices = {
  getNotificationFromDB,
  makeMeReadNotification,
  makeReadAllNotification,
  getAdminAllNotification,
  pushNotificationUser,
};
