import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { BookingServices } from './booking.service';

const createOnlineBooking = catchAsync(async (req, res) => {
  const result = await BookingServices.createOnlineBookingIntoDB(
    req.body,
    req.files,
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Service booking successfully',
    data: result,
  });
});

const createWalkInBooking = catchAsync(async (req, res) => {
  const result = await BookingServices.createWalkInBookingIntoDB(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Walk-in booking successfully',
    data: result,
  });
});

const getAllBookings = catchAsync(async (req, res) => {
  const result = await BookingServices.getAllBookingsFromDB(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Booking retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getBookingsRequest = catchAsync(async (req, res) => {
  const result = await BookingServices.getBookingsRequestFromDB(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Bookings retrieved successfully',
    data: result,
  });
});

const getBookingsHistoryByCustomer = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const status = req.query.status as string;

  if (!status) {
    throw new AppError(400, 'Status is required');
  }

  const result = await BookingServices.getBookingsHistoryByCustomerFromDB(
    userId,
    status,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Bookings fetched successfully',
    data: result,
  });
});

const getBookingsHistoryByVendor = catchAsync(async (req, res) => {
  const vendorId = req.query.vendorId as string;
  const status = req.query.status as string;

  const result = await BookingServices.getBookingsHistoryByVendorFromDB(
    vendorId,
    status,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Bookings fetched successfully',
    data: result,
  });
});

const getBookingById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await BookingServices.getBookingByIdFromDB(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Booking retrieved successfully',
    data: result,
  });
});

const bookingCompletedStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await BookingServices.bookingCompletedStatusIntoDB(
    id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'The booking has been marked as completed successfully.',
    data: result,
  });
});

const bookingCanceledStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await BookingServices.bookingCanceledStatusIntoDB(
    id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'The booking has been marked as canceled successfully.',
    data: result,
  });
});

const bookingApprovedRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await BookingServices.bookingApprovedRequestIntoDB(
    id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Booking has been approved successfully.',
    data: result,
  });
});

const bookingDeclineRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await BookingServices.bookingDeclineRequestIntoDB(
    id,
    req.body,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Booking has been decline successfully.',
    data: result,
  });
});

const getVendorAppHomeBookings = catchAsync(async (req, res) => {
  const result = await BookingServices.getVendorAppHomeBookingsFromDB(
    req.query,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Bookings retrieved successfully',
    data: result,
  });
});

const getBookingServicingNowPanel = catchAsync(async (req, res) => {
  const result = await BookingServices.getBookingServicingNowPanelFromDB(
    req.query,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Bookings Now Panel retrieved successfully',
    data: result,
  });
});

const getPendingBookingServices = catchAsync(async (req, res) => {
  const result = await BookingServices.getPendingBookingServicesFromDB(
    req.query,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Pending booking services retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getUpcomingBookings = catchAsync(async (req, res) => {
  const result = await BookingServices.getUpcomingBookingsFromDB(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Upcoming bookings retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

export const BookingControllers = {
  createOnlineBooking,
  createWalkInBooking,
  getAllBookings,
  getBookingsRequest,
  getBookingsHistoryByCustomer,
  getBookingsHistoryByVendor,
  getBookingById,
  bookingCompletedStatus,
  bookingCanceledStatus,
  bookingApprovedRequest,
  bookingDeclineRequest,
  getVendorAppHomeBookings,
  getBookingServicingNowPanel,
  getPendingBookingServices,
  getUpcomingBookings,
};
