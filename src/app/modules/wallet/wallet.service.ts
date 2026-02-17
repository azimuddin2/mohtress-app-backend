import { Payment } from '../payment/payment.model';

const getYearlyEarningChartFromDB = async (year: string) => {
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);

  const result = await Payment.aggregate([
    {
      $match: {
        status: 'paid',
        isDeleted: false,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        totalEarning: { $sum: '$vendorAmount' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Jan–Dec ensure
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const yearlyData = months.map((month, index) => {
    const found = result.find((r) => r._id === index + 1);
    return {
      month,
      value: found ? found.totalEarning : 0,
    };
  });

  const totalYearlyEarning = yearlyData.reduce(
    (sum, item) => sum + item.value,
    0,
  );

  return {
    year,
    totalYearlyEarning,
    // growth: '+4.91%', // optional (calculate later)
    data: yearlyData,
  };
};

export const WalletService = {
  getYearlyEarningChartFromDB,
};
