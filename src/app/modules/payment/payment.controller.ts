import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PaymentService } from './payment.service';
import config from '../../config';

const createPayment = catchAsync(async (req: Request, res: Response) => {
  const url = await PaymentService.createPayment(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Payment link get successful',
    data: url,
  });
});

const confirmPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.confirmPayment(
    req.query as { sessionId: string; paymentId: string },
  );
  res.redirect(
    config.server_url +
      `/api/v1/payments/success?paymentId=${result.payment._id}`,
  );
});

const cancelPayment = catchAsync(async (req: Request, res: Response) => {
  const { paymentId } = req.query as { paymentId?: string };

  if (paymentId) {
    await PaymentService.cancelPayment(paymentId);
  }

  res.redirect(config.server_url + '/payment/cancel');
});

export const PaymentController = {
  createPayment,
  confirmPayment,
  cancelPayment,
};
