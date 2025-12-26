import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PaymentService } from './payment.service';
import dayjs from 'dayjs';

const createPayment = catchAsync(async (req: Request, res: Response) => {
  const url = await PaymentService.createPayment(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Stripe checkout url created',
    data: {
      checkoutUrl: url,
    },
  });
});

const confirmPayment = catchAsync(async (req: Request, res: Response) => {
  const { sessionId, paymentId } = req.query as {
    sessionId: string;
    paymentId: string;
  };

  const result = await PaymentService.confirmPayment({ sessionId, paymentId });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment successful',
    data: {
      paymentId: result.payment._id,
      trnId: result.payment.trnId,
      amount: result.payment.price,
      status: result.payment.status,
      date: dayjs(result.payment.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    },
  });
});

const cancelPayment = catchAsync(async (req: Request, res: Response) => {
  const { paymentId } = req.query as { paymentId?: string };

  if (paymentId) {
    await PaymentService.cancelPayment(paymentId);
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment cancelled successfully',
    data: {
      paymentId,
      status: 'cancelled',
    },
  });
});

export const PaymentController = {
  createPayment,
  confirmPayment,
  cancelPayment,
};
