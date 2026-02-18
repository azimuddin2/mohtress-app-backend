import AppError from '../../errors/AppError';
import { Payment } from '../payment/payment.model';
import { TUser } from '../user/user.interface';
import { User } from '../user/user.model';
import { getCurrentWeekRange } from './wallet.utils';

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

export const WalletService = {
  getWeeklyEarningChartFromDB,
};
