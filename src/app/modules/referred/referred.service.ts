import httpStatus from 'http-status';
import QueryBuilder from '../../builder/QueryBuilder';
import { IReferred } from './referred.interface';
import { Referred } from './referred.model';
import { customAlphabet } from 'nanoid';
import { User } from '../user/user.model';
import AppError from '../../errors/AppError';

// Generate 10-char unique referral code
const nanoid = customAlphabet(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  10,
);

const createReferredLink = async (payload: IReferred) => {
  const { user } = payload;

  // Generate new referral code
  const referralCode = nanoid();

  const existing = await Referred.findOne({ user });

  if (existing) {
    return existing;
  }

  payload.referralCode = referralCode;
  const result = await Referred.create(payload);

  await User.findOneAndUpdate(
    { _id: user },
    { referralCode: referralCode },
    { new: true, upsert: true, runValidators: true },
  );

  return result;
};

const allReferredData = async (query: Record<string, unknown>) => {
  const baseQuery = Referred.find({ isActive: true }).populate(
    'user',
    'email firstName lastName isReferral referralCode referredBy helper.Identity limit phoneNumber',
  );
  const paymentQuery = new QueryBuilder(baseQuery, query)
    .filter()
    .sort()
    .fields()
    .paginate();
  const data = await paymentQuery.modelQuery;
  const meta = await paymentQuery.countTotal();

  return {
    meta,
    data,
  };
};

const singleReferredData = async (id: string) => {
  const result = await Referred.findById(id).populate(
    'user',
    'email firstName lastName isReferral referralCode referredBy helper.Identity limit phoneNumber',
  );
  return result;
};

const blockReferred = async (id: string) => {
  const referred = await Referred.findById(id);
  if (!referred) {
    throw new Error('Referred not found');
  }

  if (!referred.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Referred already blocked');
  }

  const user = await User.findById(referred.user);
  if (!user) {
    throw new Error('User not found');
  }

  const result = await Referred.findByIdAndUpdate(
    id,
    { isActive: false },
    {
      new: true,
      upsert: true,
    },
  );

  await User.findOneAndUpdate(
    { _id: user._id },
    { referralCode: null },
    { new: true, upsert: true, runValidators: true },
  );

  return result;
};

const reActiveReferred = async (id: string) => {
  const referred = await Referred.findById(id);
  if (!referred) {
    throw new Error('Referred not found');
  }

  if (referred.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Referred already active');
  }

  const user = await User.findById(referred.user);
  if (!user) {
    throw new Error('User not found');
  }

  const result = await Referred.findByIdAndUpdate(
    id,
    { isActive: true },
    {
      new: true,
      upsert: true,
    },
  );

  await User.findOneAndUpdate(
    { _id: user._id },
    { referralCode: referred.referralCode },
    { new: true, upsert: true, runValidators: true },
  );

  return result;
};

const incrementLimit = async (limit: number, referredId: string) => {
  const result = await Referred.findOneAndUpdate(
    { _id: referredId },
    { $inc: { limit: limit } },
    { new: true },
  );

  return result;
};

const decrementLimit = async (referredId: string, limit: number) => {
  const result = await Referred.findOneAndUpdate(
    { _id: referredId },
    { $inc: { limit: -limit } },
    { new: true },
  );

  return result;
};

const myAllReferredHelper = async (
  myId: string,
  query: Record<string, unknown>,
) => {
  if (!myId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You are not authorized');
  }

  const baseQuery = User.find({
    referredBy: myId,
    isActive: true,
    isDeleted: false,
  })
    .select(
      'name firstName referralCode lastName phoneNumber gender dateOfBirth nationality role address status helper createdAt updatedAt helper isReferral referredBy',
    )
    .populate(
      'referredBy',
      'email firstName lastName isReferral referralCode referredBy helper.Identity limit phoneNumber',
    );

  const referredQuery = new QueryBuilder(baseQuery, query)
    .search([])
    .filter()
    .sort()
    .fields()
    .paginate();

  const data = await referredQuery.modelQuery;
  const meta = await referredQuery.countTotal();

  return {
    meta,
    data,
  };
};

const myReferredHelperDetails = async (id: string) => {
  if (!id) {
    throw new AppError(httpStatus.BAD_REQUEST, 'The helper not found');
  }

  const result = await User.findById(id)
    .select(
      'name firstName referralCode lastName phoneNumber gender dateOfBirth nationality role address status helper createdAt updatedAt helper isReferral referredBy',
    )
    .populate(
      'referredBy',
      'email firstName lastName isReferral referralCode referredBy helper.Identity limit phoneNumber',
    );
  return result;
};

export const referredService = {
  createReferredLink,
  allReferredData,
  singleReferredData,
  blockReferred,
  reActiveReferred,
  incrementLimit,
  decrementLimit,
  myAllReferredHelper,
  myReferredHelperDetails,
};
