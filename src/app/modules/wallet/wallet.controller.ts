import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { WalletService } from './wallet.service';
import sendResponse from '../../utils/sendResponse';

const getYearlyEarningChart = catchAsync(
  async (req: Request, res: Response) => {
    const year = req.query as any;
    const result = await WalletService.getYearlyEarningChartFromDB(year);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: '',
      data: result,
    });
  },
);

export const WalletController = {
  getYearlyEarningChart,
};
