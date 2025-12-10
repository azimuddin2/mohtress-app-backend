import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import Notification from './notification.model';
import { notificationServices } from './notification.service';
import AppError from '../../errors/AppError';

const getAllNotification = catchAsync(async (req: Request, res: Response) => {
  const query = { ...req.query };
  query['receiver'] = req.user.userId;
  const result = await notificationServices.getNotificationFromDB(query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notifications retrieved successfully',
    data: result,
  });
});

const makeRead = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const isNotification = await Notification.findOne({
    _id: id,
    receiver: req.user.userId,
  });

  if (!isNotification)
    throw new AppError(httpStatus.NOT_FOUND, 'Notification is not exist!');

  if (isNotification?.receiver?.toString() != req.user.userId.toString()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not owner to this notification',
    );
  }

  const result = await notificationServices.makeMeRead(id, req.user.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notifications read successfully',
    data: result,
  });
});

const makeReadAll = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationServices.makeReadAll(req.user.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All Notifications read successfully',
    data: result,
  });
});

const getAdminAllNotification = catchAsync(
  async (req: Request, res: Response) => {
    const result = await notificationServices.getAdminAllNotification(
      req.query,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'All Notifications fetched successfully',
      data: result,
    });
  },
);

const pushNotificationUser = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationServices.pushNotificationUser(
    req.body,
    req.user?.role as string,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notifications sent successfully',
    data: result,
  });
});

export const notificationController = {
  getAllNotification,
  makeRead,
  makeReadAll,
  getAdminAllNotification,
  pushNotificationUser,
};
