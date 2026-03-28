import { TUser } from '../user/user.interface';

export const getCurrentWeekRange = () => {
  const now = new Date();

  // UTC day (0 = Sunday)
  const day = now.getUTCDay();

  // Go back to Sunday
  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - day,
      0,
      0,
      0,
      0,
    ),
  );

  const endDate = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate() + 6,
      23,
      59,
      59,
      999,
    ),
  );

  return { startDate, endDate };
};

export const getCurrentMonthRange = () => {
  const now = new Date();

  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );

  const endDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );

  return {
    startDate,
    endDate,
    daysInMonth: endDate.getUTCDate(),
  };
};

export const getCurrentYearRange = () => {
  const now = new Date();

  const startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));

  const endDate = new Date(
    Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999),
  );

  return {
    startDate,
    endDate,
    year: now.getUTCFullYear(),
  };
};

export const getTodayRange = () => {
  const now = new Date();

  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const endDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return { startDate, endDate };
};

export const buildMatchStage = (
  user: TUser,
  startDate: Date,
  endDate: Date,
): Record<string, any> => {
  const match: Record<string, any> = {
    status: 'paid',
    isDeleted: false,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  if (user.role === 'freelancer' || user.role === 'owner') {
    match.vendor = user._id;
  }

  if (user.role === 'customer') {
    match.customer = user._id;
  }

  return match;
};

export const getAmountField = (role: string): string => {
  return role === 'customer' ? '$price' : '$vendorAmount';
};
