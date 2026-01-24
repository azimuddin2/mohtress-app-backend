import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { BookingValidation } from './booking.validation';
import { BookingControllers } from './booking.controller';
import parseData from '../../middlewares/parseData';
import multer, { memoryStorage } from 'multer';

const router = express.Router();
const upload = multer({ storage: memoryStorage() });

router.post(
  '/',
  auth('customer'),
  upload.fields([{ name: 'images', maxCount: 3 }]),
  parseData(),
  validateRequest(BookingValidation.createBookingValidationSchema),
  BookingControllers.createOnlineBooking,
);

router.post('/walk-in', BookingControllers.createWalkInBooking);

router.get(
  '/vendor-home',
  auth('owner', 'freelancer'),
  BookingControllers.getVendorAppHomeBookings,
);

router.get(
  '/servicing-now-panel',
  auth('admin', 'sub-admin'),
  BookingControllers.getBookingServicingNowPanel,
);

router.get(
  '/request',
  auth('owner', 'freelancer'),
  BookingControllers.getBookingsRequest,
);

router.get('/all', auth('admin'), BookingControllers.getAllBookings);

router.get(
  '/',
  auth('customer'),
  BookingControllers.getBookingsHistoryByCustomer,
);

router.get(
  '/history',
  auth('freelancer', 'owner'),
  BookingControllers.getBookingsHistoryByVendor,
);

router.get('/:id', BookingControllers.getBookingById);

router.put(
  '/completed-status/:id',
  auth('customer', 'freelancer', 'owner'),
  validateRequest(BookingValidation.updateBookingStatusValidationSchema),
  BookingControllers.bookingCompletedStatus,
);

router.put(
  '/canceled-status/:id',
  auth('customer', 'freelancer', 'owner'),
  validateRequest(BookingValidation.updateBookingStatusValidationSchema),
  BookingControllers.bookingCanceledStatus,
);

router.put(
  '/approved-request/:id',
  auth('freelancer', 'owner'),
  validateRequest(BookingValidation.updateBookingRequestValidationSchema),
  BookingControllers.bookingApprovedRequest,
);

router.put(
  '/decline-request/:id',
  auth('freelancer', 'owner'),
  validateRequest(BookingValidation.updateBookingRequestValidationSchema),
  BookingControllers.bookingDeclineRequest,
);

export const BookingRoutes = router;
