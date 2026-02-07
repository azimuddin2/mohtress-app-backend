import mongoose, { startSession } from 'mongoose';
import { Payment } from './payment.model';
import { User } from '../user/user.model';
import { Booking } from '../booking/booking.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import config from '../../config';
import StripeService from '../../class/stripe';
import { sendNotification } from '../notification/notification.utils';
import { TPayment } from './payment.interface';
import { generateTrxId } from './payment.utils';
import QueryBuilder from '../../builder/QueryBuilder';
import { paymentSearchableFields } from './payment.constant';

const createPayment = async (payload: TPayment) => {
  const DEPOSIT_AMOUNT = 10; // USD Fixed deposit amount

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
      throw new AppError(httpStatus.BAD_REQUEST, 'Deposit already paid');
    }

    const trnId = generateTrxId();

    // Create pending payment
    const payment = await Payment.create(
      [
        {
          customer: booking.customer,
          vendor: booking.vendor,
          booking: payload.booking,
          customerName: booking.customerName || '',
          customerEmail: booking.email || '',
          type: 'deposit',
          trnId,
          price: DEPOSIT_AMOUNT,
          adminAmount: DEPOSIT_AMOUNT / 2, // MohTress $5
          vendorAmount: DEPOSIT_AMOUNT / 2, // Stylist $5
          status: 'pending',
          isPaid: false,
        },
      ],
      { session },
    ).then((docs) => docs[0]);

    if (!payment) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment creation failed');
    }

    // Create Stripe Customer if missing
    const customerUser = await User.findById(payment.customer).session(session);
    if (!customerUser) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    let customerId = customerUser.stripeCustomerId;
    if (!customerId) {
      const customer = await StripeService.createCustomer(
        customerUser.email!,
        customerUser.fullName!,
      );
      customerId = customer.id;
      await User.findByIdAndUpdate(
        customerUser._id,
        { stripeCustomerId: customerId },
        { session },
      );
    }

    // Ensure stylist is onboarded
    const stylist = await User.findById(payment.vendor).session(session);
    if (!stylist || !stylist.stripeAccountId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Stylist has not completed Stripe onboarding account setup',
      );
    }

    // Stripe checkout session
    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'MohTress Deposit Payment' },
          unit_amount: Math.round(DEPOSIT_AMOUNT * 100),
        },
        quantity: 1,
      },
    ];

    const successUrl = `${config.server_url}/api/v1/payments/confirm-payment?sessionId={CHECKOUT_SESSION_ID}&paymentId=${payment._id}`;
    const cancelUrl = `${config.server_url}/api/v1/payments/cancel?paymentId=${payment._id}`;

    const checkoutSession = await StripeService.getCheckoutSession(
      lineItems,
      successUrl,
      cancelUrl,
      customerId,
      'usd',
      stylist.stripeAccountId, // auto-split to stylist
    );

    payment.stripeSessionId = checkoutSession.id;
    await payment.save({ session });

    await session.commitTransaction();
    return checkoutSession.url;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const confirmPayment = async (query: {
  sessionId: string;
  paymentId: string;
}) => {
  const { sessionId, paymentId } = query;
  const session = await startSession();

  try {
    const paymentSession = await StripeService.getPaymentSession(sessionId);
    const isPaid = await StripeService.isPaymentSuccess(sessionId);
    if (!isPaid)
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment not completed');

    session.startTransaction();

    const payment = await Payment.findByIdAndUpdate(
      paymentId,
      {
        status: 'paid',
        isPaid: true,
        paymentIntentId: paymentSession.payment_intent,
      },
      { new: true, session },
    )
      .populate('customer')
      .populate('vendor');

    if (!payment) throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');

    const booking = await Booking.findByIdAndUpdate(
      payment.booking,
      { status: 'pending', isPaid: true },
      { new: true, session },
    );

    if (!booking) throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');

    // Update vendor balance
    const vendor = await User.findByIdAndUpdate(
      payment.vendor,
      { $inc: { balance: payment.vendorAmount } },
      { session },
    );

    if (vendor?.fcmToken) {
      sendNotification([vendor.fcmToken], {
        title: 'Payment successful',
        message: `Your deposit has been received!`,
        receiver: vendor._id as any,
        receiverEmail: vendor.email,
        receiverRole: vendor.role as string,
        sender: vendor._id as any,
        type: 'payment',
      });
    }

    await session.commitTransaction();
    return { message: 'Deposit confirmed successfully', payment, booking };
  } catch (error: any) {
    await session.abortTransaction();
    try {
      await StripeService.refund(sessionId);
    } catch (e: any) {
      console.error('Refund failed', e.message);
    }
    throw new AppError(httpStatus.BAD_GATEWAY, error.message);
  } finally {
    session.endSession();
  }
};

const cancelPayment = async (paymentId: string) => {
  if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId))
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid paymentId');

  const session = await startSession();
  session.startTransaction();

  try {
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) throw new AppError(httpStatus.NOT_FOUND, 'Payment not found');
    if (payment.status === 'paid')
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Cannot cancel a paid deposit',
      );

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

const getAllPaymentsFormDB = async (query: Record<string, unknown>) => {
  const paymentQuery = new QueryBuilder(
    Payment.find({ isDeleted: false, isPaid: true, status: 'paid' })
      .populate({
        path: 'customer',
        select: 'fullName email phone streetAddress image stripeCustomerId ',
      })
      .populate({
        path: 'vendor',
        select: 'fullName email phone streetAddress stripeAccountId',
      }),
    query,
  )
    .search(paymentSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await paymentQuery.countTotal();
  const data = await paymentQuery.modelQuery;

  return { meta, data };
};

const getPaymentByIdFromDB = async (id: string) => {
  const result = await Payment.findById(id)
    .populate({
      path: 'customer',
      select: 'fullName email phone streetAddress image stripeCustomerId ',
    })
    .populate({
      path: 'vendor',
      select: 'fullName email phone streetAddress stripeAccountId',
    });

  if (!result) {
    throw new AppError(404, 'This payment transaction not found');
  }

  if (result.isDeleted) {
    throw new AppError(400, 'This payment transaction has been deleted');
  }

  return result;
};

export const PaymentService = {
  createPayment,
  confirmPayment,
  cancelPayment,
  getAllPaymentsFormDB,
  getPaymentByIdFromDB,
};
