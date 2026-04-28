import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PriceService } from './price.service';

const getPrice = catchAsync(async (req: Request, res: Response) => {
  const result = await PriceService.getPriceFromDB();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Price retrieved successfully',
    data: result,
  });
});

const upsertPrice = catchAsync(async (req, res) => {
  const result = await PriceService.upsertPriceIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Price saved successfully',
    data: result,
  });
});

export const PriceController = {
  getPrice,
  upsertPrice,
};
