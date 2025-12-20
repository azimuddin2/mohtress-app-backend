import config from '../../config';
import httpStatus from 'http-status';
import StripeService from '../../class/stripe';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';

// Create Stripe account and return the account link URL
const stripLinkAccount = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found!');
  }

  try {
    const account = await StripeService.getStripe().accounts.create({
      // email: user?.email, (optional: uncomment if you want to pass user's email)
    });
    const refresh_url = `${config?.server_url}/stripe/refresh/${account.id}?userId=${user?._id}`;

    const return_url = `${config?.client_Url}/seller/confirmation?userId=${user._id}&stripeAccountId=${account.id}`;

    const accountLink = await StripeService.connectAccount(
      return_url,
      refresh_url,
      account?.id,
    );

    return accountLink.url;
  } catch (error: any) {
    throw new AppError(httpStatus.BAD_GATEWAY, error.message);
  }
};

// Handle Stripe OAuth and save the connected account ID
const handleStripeOAuth = async (
  query: Record<string, any>,
  userId: string,
) => {
  try {
    const response = await StripeService.getStripe().oauth.token({
      grant_type: 'authorization_code',

      code: query.code as string,
    });

    const connectedAccountId = response.stripe_user_id;

    await User.findByIdAndUpdate(userId, {
      stripeAccountId: connectedAccountId,
    });
  } catch (error: any) {
    throw new AppError(httpStatus.BAD_REQUEST, error.message);
  }
};

// Refresh the account link for a given payment ID
const refresh = async (paymentId: string, query: Record<string, any>) => {
  const user = await User.findById(query.userId);

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found!');
  }

  try {
    const refresh_url = `${config?.server_url}/stripe/refresh/${paymentId}?userId=${user?._id}`;

    const return_url = `${config?.client_Url}/seller/confirmation?userId=${user._id}&stripeAccountId=${paymentId}`;
    const accountLink = await StripeService.connectAccount(
      return_url,
      refresh_url,
      paymentId,
    );
    return accountLink.url;
  } catch (error: any) {
    throw new AppError(httpStatus.BAD_REQUEST, error.message);
  }
};

// Handle the return URL and update the user's Stripe account ID
const returnUrl = async (payload: {
  stripeAccountId: string;
  userId: string;
}) => {
  try {
    const user = await User.findByIdAndUpdate(payload.userId, {
      stripeAccountId: payload?.stripeAccountId,
    });

    if (!user) {
      throw new AppError(httpStatus.BAD_REQUEST, 'user not found!');
    }
    return { url: config.client_Url + 'login' };
  } catch (error: any) {
    throw new AppError(httpStatus.BAD_REQUEST, error.message);
  }
};

export const stripeService = {
  handleStripeOAuth,
  stripLinkAccount,
  refresh,
  returnUrl,
};
