import mongoose, { startSession } from 'mongoose';
import { Payment } from './payment.model';
import { User } from '../user/user.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import config from '../../config';
import StripePaymentService from '../../class/stripe';
import QueryBuilder from '../../builder/QueryBuilder';
import { TPayment } from './payment.interface';
import { Booking } from '../booking/booking.model';
import { sendNotification } from '../notification/notification.utils';

// 🔹 Helper → calculate commission split (10% admin, 90% vendor)
const calculateAmounts = (price: number) => ({
  adminAmount: price * 0.1,
  vendorAmount: price * 0.9,
});

const createPayment = async (payload: TPayment) => {
  const session = await startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(payload.booking).lean().exec();
    if (!booking) {
      throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
    }

    // Prevent duplicate paid record
    const existingPaid = await Payment.findOne({
      booking: payload.booking,
      status: 'paid',
      isDeleted: false,
    });

    if (existingPaid) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payment already completed for this booking',
      );
    }

    // Reuse pending payment or create new one
    let payment = await Payment.findOne({
      booking: payload.booking,
      status: 'pending',
      isDeleted: false,
    }).session(session);

    const trnId = Math.random().toString(36).substring(2, 12);

    if (payment) {
      payment.trnId = trnId;
      payment.price = booking.totalPrice;

      const { adminAmount, vendorAmount } = calculateAmounts(
        booking.totalPrice,
      );
      payment.adminAmount = adminAmount;
      payment.vendorAmount = vendorAmount;

      await payment.save({ session });
    } else {
      const { adminAmount, vendorAmount } = calculateAmounts(
        booking.totalPrice,
      );

      payment = await Payment.create(
        [
          {
            user: booking.customer,
            vendor: booking.vendor,
            booking: payload.booking,
            trnId,
            price: booking.totalPrice,
            adminAmount,
            vendorAmount,
          },
        ],
        { session },
      ).then((docs) => docs[0]);
    }

    if (!payment) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment creation failed');
    }

    // Create Stripe Customer if missing
    const user = await User.findById(payment.user).session(session);
    if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await StripePaymentService.createCustomer(
        user.email!,
        user.fullName!,
      );
      customerId = customer.id;

      await User.findByIdAndUpdate(
        user._id,
        { stripeCustomerId: customerId },
        { session },
      );
    }

    const lineItems: any = [
      {
        price_data: {
          currency: config.currency,
          product_data: { name: 'Service Booking Payment' },
          unit_amount: Math.round(booking.totalPrice * 100),
        },
        quantity: 1,
      },
    ];

    const successUrl = `${config.server_url}/api/v1/payments/confirm-payment?sessionId={CHECKOUT_SESSION_ID}&paymentId=${payment._id}`;
    const cancelUrl = `${config.server_url}/api/v1/payments/cancel?paymentId=${payment._id}`;

    const checkoutSession = await StripePaymentService.getCheckoutSession(
      lineItems,
      successUrl,
      cancelUrl,
      config.currency,
      customerId,
    );

    await session.commitTransaction();
    return checkoutSession?.url;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const confirmPayment = async (query: Record<string, any>) => {
  const { sessionId, paymentId } = query;
  const session = await startSession();

  try {
    const paymentSession =
      await StripePaymentService.getPaymentSession(sessionId);

    const paymentIntentId = paymentSession.payment_intent as string;

    const isPaid = await StripePaymentService.isPaymentSuccess(sessionId);

    if (!isPaid) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payment session is not completed',
      );
    }

    session.startTransaction();

    const payment = await Payment.findByIdAndUpdate(
      paymentId,
      {
        status: 'paid',
        isPaid: true,
        paymentIntentId,
      },
      { new: true, session },
    ).populate([
      { path: 'user', select: '_id fullName email phone image' },
      { path: 'vendor', select: '_id fullName email phone image' },
    ]);

    if (!payment) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
    }

    const booking = await Booking.findByIdAndUpdate(
      payment.booking,
      {
        status: 'pending',
        isPaid: true,
      },
      { new: true, session },
    );

    if (!booking) {
      throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
    }

    // Vendor balance increment
    const user = await User.findByIdAndUpdate(
      payment.vendor,
      {
        $inc: { balance: payment.vendorAmount },
      },
      { session },
    );

    if (user?.fcmToken) {
      sendNotification([user?.fcmToken], {
        title: `Payment successfully`,
        message: `Your payment is completed successfully!`,
        receiver: user._id as any,
        receiverEmail: user.email,
        receiverRole: user?.role as string,
        sender: user._id as any,
        type: 'payment',
      });
    }

    await session.commitTransaction();

    return {
      message: 'Payment confirmed successfully',
      payment,
      booking,
    };
  } catch (error: any) {
    await session.abortTransaction();

    try {
      await StripePaymentService.refund(sessionId);
    } catch (refundError: any) {
      console.error('Refund error:', refundError.message);
    }

    throw new AppError(httpStatus.BAD_GATEWAY, error.message);
  } finally {
    session.endSession();
  }
};

const cancelPayment = async (paymentId?: string) => {
  if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid paymentId');
  }

  const session = await startSession();
  session.startTransaction();

  try {
    const payment = await Payment.findById(paymentId).session(session);

    if (!payment) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
    }

    if (payment.status === 'paid') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Cannot cancel a completed payment',
      );
    }

    payment.status = 'cancelled';
    await payment.save({ session });

    await session.commitTransaction();
    return payment;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const successPayment = async (query: Record<string, any>) => {
  return;
};

const getAllPaymentFromDB = async (query: Record<string, unknown>) => {
  const { vendor, ...filters } = query;

  if (!vendor || !mongoose.Types.ObjectId.isValid(vendor as string)) {
    throw new AppError(400, 'Invalid Vendor ID');
  }

  let paymentQuery = Payment.find({ vendor, isDeleted: false })
    .populate('vendor')
    .populate('user');

  const queryBuilder = new QueryBuilder(paymentQuery, filters)
    .search([''])
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await queryBuilder.countTotal();
  const result = await queryBuilder.modelQuery;

  return { meta, result };
};

export const PaymentService = {
  createPayment,
  confirmPayment,
  cancelPayment,
  successPayment,
  getAllPaymentFromDB,
};
