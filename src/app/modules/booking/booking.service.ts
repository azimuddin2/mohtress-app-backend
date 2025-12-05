import AppError from '../../errors/AppError';
import { Booking } from './booking.model';
import { SERVICE_MODEL_TYPE, TBooking } from './booking.interface';
import { User } from '../user/user.model';
import { OwnerService } from '../ownerService/ownerService.model';
import { FreelancerService } from '../freelancerService/freelancerService.model';
import { uploadManyToS3 } from '../../utils/awsS3FileUploader';
import { Specialist } from '../Specialist/Specialist.model';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import { bookingSearchableFields } from './booking.constant';
import { getCurrentMinutes } from './booking.utils';

const createBookingIntoDB = async (payload: TBooking, files: any) => {
  const { customer, service, vendor, date, time, specialist, serviceType } =
    payload;

  // -------------------------------
  // 1️⃣ Validate Time Format
  // -------------------------------
  const timeRegex = /^\d{1,2}:\d{2} (AM|PM) - \d{1,2}:\d{2} (AM|PM)$/;
  if (!timeRegex.test(time)) {
    throw new AppError(
      400,
      'Invalid time format. Use: "hh:mm AM - hh:mm PM" (Example: 05:30 PM - 06:30 PM)',
    );
  }

  // -------------------------------
  // 2️⃣ Convert time to minutes
  // -------------------------------
  const parseToMinutes = (t: string) => {
    const [timeStr, mod] = t.trim().split(' ');
    let [h, m] = timeStr.split(':').map(Number);

    if (h < 1 || h > 12 || m < 0 || m > 59) {
      throw new AppError(400, 'Invalid time range values');
    }

    if (mod === 'PM' && h !== 12) h += 12;
    if (mod === 'AM' && h === 12) h = 0;

    return h * 60 + m;
  };

  const [slotStartStr, slotEndStr] = time.split(' - ');
  const slotStart = parseToMinutes(slotStartStr);
  const slotEnd = parseToMinutes(slotEndStr);

  // -------------------------------
  // 3️⃣ Validate Start < End
  // -------------------------------
  if (slotEnd <= slotStart) {
    throw new AppError(400, 'End time must be later than start time');
  }

  // -------------------------------
  // 4️⃣ Auto duration (hours)
  // -------------------------------
  payload.duration = ((slotEnd - slotStart) / 60).toString();

  // -------------------------------
  // 5️⃣ Validate Date
  // -------------------------------
  const today = new Date();
  const bookingDate = new Date(date);

  if (bookingDate < new Date(today.toDateString())) {
    throw new AppError(400, 'Cannot create booking for a past date');
  }

  // Attach slots into payload
  payload.slotStart = slotStart;
  payload.slotEnd = slotEnd;

  // -------------------------------
  // 6️⃣ Validate Customer + Vendor
  // -------------------------------
  const customerExists = await User.findById(customer);
  if (!customerExists) throw new AppError(404, 'Customer does not exist');

  const vendorExists = await User.findById(vendor);
  if (!vendorExists) throw new AppError(404, 'Vendor does not exist');

  const vendorRole = vendorExists.role; // owner | freelancer

  // -------------------------------
  // 7️⃣ Validate Service Type
  // -------------------------------
  const serviceModelMap: any = {
    [SERVICE_MODEL_TYPE.OwnerService]: OwnerService,
    [SERVICE_MODEL_TYPE.FreelancerService]: FreelancerService,
  };

  const ServiceModel = serviceModelMap[serviceType];
  if (!ServiceModel) throw new AppError(400, 'Invalid service type');

  const serviceExists = await ServiceModel.findById(service);
  if (!serviceExists) throw new AppError(404, 'Service does not exist');

  // -------------------------------
  // 8️⃣ Specialist Logic
  // -------------------------------
  if (vendorRole === 'owner') {
    if (!specialist) {
      throw new AppError(400, 'Specialist ID is required for owner vendor');
    }

    const dbSpecialist = await Specialist.findById(specialist);
    if (!dbSpecialist) {
      throw new AppError(404, 'Specialist does not exist');
    }

    // Specialist conflict check using specialist _id
    const specialistConflict = await Booking.findOne({
      specialist,
      date,
      isDeleted: false,
      slotStart: { $lt: slotEnd },
      slotEnd: { $gt: slotStart },
    });

    if (specialistConflict) {
      throw new AppError(409, 'Specialist is not available at this time');
    }
  }

  if (vendorRole === 'freelancer') {
    if (specialist) {
      throw new AppError(400, 'Freelancers cannot assign specialists');
    }
  }

  // -------------------------------
  // 9️⃣ Vendor Conflict Check
  // -------------------------------
  const vendorConflict = await Booking.findOne({
    vendor,
    date,
    isDeleted: false,
    slotStart: { $lt: slotEnd },
    slotEnd: { $gt: slotStart },
  });

  if (vendorConflict) {
    throw new AppError(409, 'Vendor already has a booking at this time');
  }

  // -------------------------------
  // 🔟 File Upload
  // -------------------------------
  if (files?.images?.length) {
    const imgsArray = files.images.map((img: any) => ({
      file: img,
      path: 'images/service',
    }));
    payload.images = await uploadManyToS3(imgsArray);
  } else {
    throw new AppError(400, 'At least one image is required');
  }

  // -------------------------------
  // 1️⃣1️⃣ Save Booking
  // -------------------------------
  return await Booking.create(payload);
};

const getAllBookingsFromDB = async (query: Record<string, unknown>) => {
  const mongooseQuery = Booking.find({ isDeleted: false })
    .populate({
      path: 'customer',
      select: 'fullName email phone image',
    })
    .populate({
      path: 'vendor',
      select: 'fullName email phone image',
    })
    .populate({
      path: 'service',
      select: 'name price duration category images',
    });

  const bookingQuery = new QueryBuilder(mongooseQuery, query)
    .search(bookingSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await bookingQuery.countTotal();
  const result = await bookingQuery.modelQuery;

  return { meta, result };
};

const getBookingsRequestFromDB = async (query: Record<string, unknown>) => {
  const { vendor } = query;

  if (!vendor || !mongoose.Types.ObjectId.isValid(vendor as string)) {
    throw new AppError(400, 'Invalid Owner Or Freelancer ID');
  }

  const filter = { vendor: vendor as string, isDeleted: false };

  const result = await Booking.find(filter)
    .populate('service')
    .populate({
      path: 'vendor',
      select:
        '_id fullName email phone streetAddress city state image location',
    })
    .populate({
      path: 'customer',
      select: '_id fullName email phone streetAddress city state image',
    })
    .populate({
      path: 'specialist',
      select: 'name image',
    })
    .sort({ createdAt: -1 })
    .select('-__v -isDeleted');

  if (!result || result.length === 0) {
    throw new AppError(404, 'Booking not found');
  }

  return result;
};

const getBookingsHistoryByCustomerFromDB = async (userId: string, status: string) => {
  const user = await User.findById(userId).select('role email');

  if (!user?.email) {
    throw new AppError(404, 'User not found');
  }

  if (user.role !== 'customer') {
    throw new AppError(403, 'Only customer can perform this access');
  }

  // If no status = throw error
  if (!status) {
    throw new AppError(400, 'Booking status is required');
  }

  const query = {
    email: user.email,
    isDeleted: false,
    status, // required filter
  };

  const bookings = await Booking.find(query)
    .populate('service')
    .populate({
      path: 'vendor',
      select:
        '_id fullName email phone streetAddress city state image location',
    })
    .populate({
      path: 'customer',
      select: '_id fullName email phone streetAddress city state image',
    })
    .populate({
      path: 'specialist',
      select: 'name image',
    })
    .sort({ createdAt: -1 })
    .select('-__v -isDeleted');

  return bookings;
};

const getBookingByIdFromDB = async (id: string) => {
  const result = await Booking.findById(id)
    .populate('service')
    .populate({
      path: 'vendor',
      select:
        '_id fullName email phone streetAddress city state image location',
    })
    .populate({
      path: 'customer',
      select: '_id fullName email phone streetAddress city state image',
    })
    .populate({
      path: 'specialist',
      select: 'name image',
    })
    .sort({ createdAt: -1 })
    .select('-__v -isDeleted');

  if (!result) {
    throw new AppError(404, 'This Booking not found');
  }

  if (result.isDeleted === true) {
    throw new AppError(400, 'This Booking has been deleted');
  }

  return result;
};

const bookingCompletedStatusIntoDB = async (
  id: string,
  payload: { status: string },
) => {
  const isBookingExists = await Booking.findById(id);

  if (!isBookingExists) {
    throw new AppError(404, 'This booking is not found');
  }

  const result = await Booking.findByIdAndUpdate(id, payload, { new: true });
  return result;
};

const bookingCanceledStatusIntoDB = async (
  id: string,
  payload: { status: string },
) => {
  const isBookingExists = await Booking.findById(id);

  if (!isBookingExists) {
    throw new AppError(404, 'This booking is not found');
  }

  const result = await Booking.findByIdAndUpdate(id, payload, { new: true });
  return result;
};

const bookingApprovedRequestIntoDB = async (
  id: string,
  payload: { request: 'approved' | 'pending' | 'decline' },
) => {
  // 1️⃣ Check if the booking exists
  const booking = await Booking.findById(id);

  if (!booking) {
    throw new AppError(404, 'This booking is not found');
  }

  // 2️⃣ Prevent approving a booking that was already declined
  if (booking.request === 'decline') {
    throw new AppError(400, 'This booking request was already rejected');
  }

  // 3️⃣ Prevent approving a booking that is already approved
  if (booking.request === 'approved' && payload.request === 'approved') {
    throw new AppError(400, 'This booking request is already approved');
  }

  // 4️⃣ Prevent approving a booking if the time slot has already passed
  const todayMinutes = getCurrentMinutes();
  const bookingMinutes: any = booking.slotStart;
  const today = new Date().toISOString().split('T')[0];

  if (booking.date === today && bookingMinutes < todayMinutes) {
    throw new AppError(400, 'Cannot approve an expired time slot');
  }

  // 5️⃣ Update only the request field in the database
  const result = await Booking.findByIdAndUpdate(
    id,
    { request: payload.request, status: 'in-process' },
    { new: true },
  );

  return result;
};

const bookingDeclineRequestIntoDB = async (
  id: string,
  payload: { request: string },
) => {
  const isBookingExists = await Booking.findById(id);

  if (!isBookingExists) {
    throw new AppError(404, 'This booking is not found');
  }

  const result = await Booking.findByIdAndUpdate(id, payload, { new: true });
  return result;
};

const getVendorAppHomeBookingsFromDB = async (
  query: Record<string, unknown>,
) => {
  const { vendor } = query;

  if (!vendor || !mongoose.Types.ObjectId.isValid(vendor as string)) {
    throw new AppError(400, 'Invalid Owner Or Freelancer ID');
  }

  const vendorId = vendor as string;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const now = getCurrentMinutes(); // current time in minutes from midnight

  // Fetch all vendor bookings
  const bookings = await Booking.find({ vendor: vendorId, isDeleted: false })
    .populate('service')
    .populate({
      path: 'vendor',
      select:
        '_id fullName email phone streetAddress city state image location',
    })
    .populate({
      path: 'customer',
      select: '_id fullName email phone streetAddress city state image',
    })
    .populate({
      path: 'specialist',
      select: 'name image',
    })
    .sort({ date: 1, slotStart: 1 })
    .select('-__v -isDeleted');

  if (!bookings?.length) {
    throw new AppError(404, 'Booking not found');
  }

  // Categorize bookings
  const inProcess: typeof bookings = [];
  const todayWaiting: typeof bookings = [];
  const nextInLine: typeof bookings = [];
  const upcoming: typeof bookings = [];

  bookings.forEach((b) => {
    const bookingDate = new Date(b.date);
    bookingDate.setHours(0, 0, 0, 0);

    const isToday = bookingDate.getTime() === today.getTime();

    // 1️⃣ In-process (highest priority)
    if (b.status === 'in-process') {
      inProcess.push(b);
      return;
    }

    // 2️⃣ Today's waiting (pending + request pending)
    if (isToday && b.status === 'pending' && b.request === 'pending') {
      todayWaiting.push(b);
      return;
    }

    // 3️⃣ Next in Line (today + pending + approved + slotStart > now)
    if (
      isToday &&
      b.status === 'pending' &&
      b.request === 'approved' &&
      b.slotStart! > now
    ) {
      nextInLine.push(b);
      return;
    }

    // 4️⃣ Upcoming (future date + approved/pending)
    if (
      bookingDate.getTime() > today.getTime() &&
      ['pending', 'approved'].includes(b.status) &&
      b.request === 'approved'
    ) {
      upcoming.push(b);
      return;
    }
  });

  // Sort nextInLine by earliest slotStart (queue order)
  nextInLine.sort((a: any, b: any) => a.slotStart - b.slotStart);

  return {
    inProcess,
    todayWaiting,
    nextInLine,
    upcoming,
  };
};

export const BookingServices = {
  createBookingIntoDB,
  getAllBookingsFromDB,
  getBookingsRequestFromDB,
  getBookingsHistoryByCustomerFromDB,
  getBookingByIdFromDB,
  bookingCompletedStatusIntoDB,
  bookingCanceledStatusIntoDB,
  bookingApprovedRequestIntoDB,
  bookingDeclineRequestIntoDB,
  getVendorAppHomeBookingsFromDB,
};
