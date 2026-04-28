import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { DashboardService } from './dashboard.service';

const getOverviewStats = catchAsync(async (req, res) => {
  const result = await DashboardService.getOverviewStatsFromDB();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Admin Dashboard Stats retrieved successfully',
    data: result,
  });
});

const getRequestStats = catchAsync(async (req, res) => {
  const result = await DashboardService.getRequestStatsFromDB();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Admin Dashboard Stats retrieved successfully',
    data: result,
  });
});

const getEarningsStats = catchAsync(async (req, res) => {
  const result = await DashboardService.getEarningsStatsFromDB();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Earnings Stats retrieved successfully',
    data: result,
  });
});

const getUserStatsFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await DashboardService.getUserStatsFromDB(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User Stats retrieved successfully',
    data: result,
  });
});

export const DashboardControllers = {
  getOverviewStats,
  getRequestStats,
  getEarningsStats,
  getUserStatsFromDB,
};
