import AppError from '../../errors/AppError';
import { Payment } from '../payment/payment.model';
import { TUser } from '../user/user.interface';
import { User } from '../user/user.model';
import {
  buildMatchStage,
  getAmountField,
  getCurrentMonthRange,
  getCurrentWeekRange,
  getCurrentYearRange,
  getTodayRange,
} from './wallet.utils';

const getWeeklyEarningChartFromDB = async (userId: string) => {
  const { startDate, endDate } = getCurrentWeekRange();

  const user = (await User.findById(userId)) as TUser | null;

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const matchStage: Record<string, any> = {
    status: 'paid',
    isDeleted: false,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  // 🔹 Role-based filtering (Based on YOUR Payment structure)
  if (user.role === 'freelancer') {
    matchStage.vendor = user._id;
  }

  if (user.role === 'customer') {
    matchStage.customer = user._id;
  }

  const result = await Payment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          day: {
            $dayOfMonth: {
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
        },
        total: { $sum: '$vendorAmount' },
      },
    },
  ]);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const data = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + i);

    const found = result.find((r) => r._id.day === date.getUTCDate());

    return {
      date: date.getUTCDate(),
      day: days[i],
      value: found ? found.total : 0,
    };
  });

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return {
    startDate,
    endDate,
    total,
    data,
  };
};

const getEarningsSummaryFromDB = async (userId: string) => {
  const user = (await User.findById(userId)) as TUser | null;
  if (!user) throw new AppError(404, 'User not found');

  const { startDate: yStart, endDate: yEnd, year } = getCurrentYearRange();
  const { startDate: mStart, endDate: mEnd } = getCurrentMonthRange();
  const { startDate: tStart, endDate: tEnd } = getTodayRange();

  const amountField = getAmountField(user.role);

  const [yearly, monthly, today] = await Promise.all([
    Payment.aggregate([
      { $match: buildMatchStage(user, yStart, yEnd) },
      { $group: { _id: null, total: { $sum: amountField } } },
    ]),
    Payment.aggregate([
      { $match: buildMatchStage(user, mStart, mEnd) },
      { $group: { _id: null, total: { $sum: amountField } } },
    ]),
    Payment.aggregate([
      { $match: buildMatchStage(user, tStart, tEnd) },
      { $group: { _id: null, total: { $sum: amountField } } },
    ]),
  ]);

  return {
    year,
    yearlyTotal: yearly[0]?.total ?? 0,
    monthlyTotal: monthly[0]?.total ?? 0,
    todayTotal: today[0]?.total ?? 0,
  };
};

export const WalletService = {
  getWeeklyEarningChartFromDB,
  getEarningsSummaryFromDB,
};
