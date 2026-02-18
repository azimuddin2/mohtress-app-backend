import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { WalletService } from './wallet.service';
import sendResponse from '../../utils/sendResponse';

const getYearlyEarningChart = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.userId;
    const result = await WalletService.getWeeklyEarningChartFromDB(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Weekly Earning data retrieved successfully.',
      data: result,
    });
  },
);

export const WalletController = {
  getYearlyEarningChart,
};
