import config from '../../config';
import httpStatus from 'http-status';
import StripeService from '../../class/stripe';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';

// Create Stripe Express account & onboarding link
const stripLinkAccount = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError(400, 'User not found');

  // CASE 1: User already has stripe account
  if (user.stripeAccountId) {
    const account = await StripeService.getStripe().accounts.retrieve(
      user.stripeAccountId,
    );

    // ✅ If onboarding already completed
    if (account.details_submitted) {
      return {
        object: 'already_connected',
        message: 'Stripe account already connected',
        accountId: user.stripeAccountId,
      };
    }

    // 🔁 Onboarding incomplete → generate new link
    const refresh_url = `${config.server_url}/api/v1/stripe/refresh/${account.id}?userId=${user._id}`;
    const return_url = `${config.server_url}/api/v1/stripe/return?userId=${user._id}&stripeAccountId=${account.id}`;

    const accountLink = await StripeService.connectAccount(
      return_url,
      refresh_url,
      account.id,
    );

    return {
      object: accountLink.object,
      url: accountLink.url,
      expires_at: accountLink.expires_at,
      accountId: account.id,
    };
  }

  // CASE 2: No stripe account → create new
  const account = await StripeService.getStripe().accounts.create({
    type: 'express',
    country: 'US',
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Save accountId immediately
  user.stripeAccountId = account.id;
  await user.save();

  const refresh_url = `${config.server_url}/api/v1/stripe/refresh/${account.id}?userId=${user._id}`;
  const return_url = `${config.server_url}/api/v1/stripe/return?userId=${user._id}&stripeAccountId=${account.id}`;

  const accountLink = await StripeService.connectAccount(
    return_url,
    refresh_url,
    account.id,
  );

  return {
    object: accountLink.object,
    url: accountLink.url,
    expires_at: accountLink.expires_at,
    accountId: account.id,
  };
};

// Refresh onboarding for incomplete accounts
const refresh = async (stripeAccountId: string, query: Record<string, any>) => {
  const user = await User.findById(query.userId);
  if (!user) throw new AppError(httpStatus.BAD_REQUEST, 'User not found');

  const refresh_url = `${config.server_url}/api/v1/stripe/refresh/${stripeAccountId}?userId=${user._id}`;
  const return_url = `${config.server_url}/api/v1/stripe/return?userId=${user._id}&stripeAccountId=${stripeAccountId}&success=true`;

  const accountLink = await StripeService.connectAccount(
    return_url,
    refresh_url,
    stripeAccountId,
  );
  return accountLink.url;
};

// Complete onboarding and save stripeAccountId in DB
const returnUrl = async (payload: {
  userId: string;
  stripeAccountId: string;
}) => {
  const account = await StripeService.getStripe().accounts.retrieve(
    payload.stripeAccountId,
  );

  // Ensure stripeAccountId saved
  const user = await User.findByIdAndUpdate(
    payload.userId,
    { stripeAccountId: payload.stripeAccountId },
    { new: true },
  );

  if (!user) throw new AppError(400, 'User not found');

  return {
    isCompleted: account.details_submitted,
  };
};

// Admin: delete all restricted test accounts
const deleteAllRestrictedTestAccounts = async () => {
  const results = await StripeService.deleteAllRestrictedAccounts();
  return { count: results.length };
};

export const stripeService = {
  stripLinkAccount,
  refresh,
  returnUrl,
  deleteAllRestrictedTestAccounts,
};
