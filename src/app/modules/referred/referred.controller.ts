import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { referredService } from './referred.service';

const createReferredLink = catchAsync(async (req, res) => {
  const user = req.user;

  req.body.user = user?.userId;

  const result = await referredService.createReferredLink(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Referred code created successfully',
    data: result,
  });
});

const allReferredData = catchAsync(async (req, res) => {
  const result = await referredService.allReferredData(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referred data fetched successfully',
    data: result,
  });
});

const singleReferredData = catchAsync(async (req, res) => {
  const result = await referredService.singleReferredData(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referred data fetched successfully',
    data: result,
  });
});

const blockReferred = catchAsync(async (req, res) => {
  const result = await referredService.blockReferred(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referred blocked successfully',
    data: result,
  });
});

const reActiveReferred = catchAsync(async (req, res) => {
  const result = await referredService.reActiveReferred(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referred re-activated successfully',
    data: result,
  });
});

const incrementLimit = catchAsync(async (req, res) => {
  const limit = Number(req.body.limit);
  const referredId = req.params.id;

  const result = await referredService.incrementLimit(limit, referredId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referred code limit updated successfully',
    data: result,
  });
});

const decrementLimit = catchAsync(async (req, res) => {
  const referredId = req.params.id;
  const limit = Number(req.body.limit);
  const result = await referredService.decrementLimit(referredId, limit);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referred code limit updated successfully',
    data: result,
  });
});

const myAllReferredHelper = catchAsync(async (req, res) => {
  const myId = req.user.userId;
  const query = req.query;
  const result = await referredService.myAllReferredHelper(myId, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referred data fetched successfully',
    data: result,
  });
});

const myReferredHelperDetails = catchAsync(async (req, res) => {
  const result = await referredService.myReferredHelperDetails(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Referred data fetched successfully',
    data: result,
  });
});

export const referredController = {
  createReferredLink,
  allReferredData,
  singleReferredData,
  blockReferred,
  reActiveReferred,
  incrementLimit,
  decrementLimit,
  myAllReferredHelper,
  myReferredHelperDetails,
};
