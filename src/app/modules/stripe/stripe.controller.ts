import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { stripeService } from './stripe.service';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import config from '../../config';
import AppError from '../../errors/AppError';

const stripLinkAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await stripeService.stripLinkAccount(userId);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    data: result,
    message: 'Stripe onboarding link generated',
  });
});

const refresh = catchAsync(async (req: Request, res: Response) => {
  const url = await stripeService.refresh(req.params.id, req.query);
  return res.redirect(url);
});

const returnUrl = catchAsync(async (req: Request, res: Response) => {
  const { userId, stripeAccountId } = req.query;

  if (!userId || !stripeAccountId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing query params');
  }

  await stripeService.returnUrl({
    userId: userId as string,
    stripeAccountId: stripeAccountId as string,
  });

  // Instead of redirect, return JSON for mobile apps
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Stripe Onboarding Account Completed',
    data: {
      redirectUrl: `${config.client_Url}/seller/success`,
    },
  });
});

const deleteAllRestricted = catchAsync(async (req: Request, res: Response) => {
  const result = await stripeService.deleteAllRestrictedTestAccounts();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Restricted accounts deleted',
    data: result,
  });
});

export const stripeController = {
  stripLinkAccount,
  refresh,
  returnUrl,
  deleteAllRestricted,
};
