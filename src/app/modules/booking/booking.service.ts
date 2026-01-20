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
import { sendNotification } from '../notification/notification.utils';
import dayjs from 'dayjs';
import { OwnerRegistration } from '../ownerRegistration/ownerRegistration.model';

// Create Online Booking API
const createOnlineBookingIntoDB = async (payload: TBooking, files: any) => {
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

  // 1️⃣1️⃣ Booking save
  const booking = await Booking.create(payload);

  // 1️⃣2️⃣ Notification (customer + vendor)
  if (customerExists?.fcmToken) {
    await sendNotification([customerExists.fcmToken], {
      title: 'Booking Confirmed',
      message: `Your booking for service ${serviceExists.name} on ${payload.date} at ${payload.time} is confirmed!`,
      receiver: customerExists._id as any,
      receiverEmail: customerExists.email,
      receiverRole: customerExists.role,
      sender: vendorExists._id as any,
      type: 'reminder',
    });
  }

  if (vendorExists?.fcmToken) {
    await sendNotification([vendorExists.fcmToken], {
      title: 'New Booking Received',
      message: `You have a new booking from ${customerExists.email} on ${payload.date} at ${payload.time}`,
      receiver: vendorExists._id as any,
      receiverEmail: vendorExists.email,
      receiverRole: vendorExists.role,
      sender: customerExists._id as any,
      type: 'booking',
    });
  }

  return booking;
};

// Create  Walk-in booking API
const createWalkInBookingIntoDB = async (payload: TBooking) => {
  const { qrToken, customerName, phone, service } = payload;

  console.log('Payload received for walk-in booking:', payload);

  // 1️⃣ Validate QR token
  const owner = await OwnerRegistration.findOne({ qrToken });
  if (!owner) throw new AppError(404, 'Invalid QR code');

  // 2️⃣ Get service
  const getService = await OwnerService.findById(service);
  if (!getService) throw new AppError(404, 'Service not found');

  const serviceDuration = Number(getService.time);
  if (isNaN(serviceDuration) || serviceDuration <= 0)
    throw new AppError(400, 'Invalid service duration');

  // 3️⃣ Get today date
  const today = new Date().toISOString().split('T')[0];

  // 4️⃣ Find last booking for this vendor today
  const lastBooking = await Booking.findOne({
    vendor: owner.user,
    date: today,
    isDeleted: false,
  }).sort({ slotEnd: -1 });

  // 5️⃣ Auto calculate slotStart & slotEnd
  const now = new Date();
  const nowInMinutes = now.getHours() * 60 + now.getMinutes();

  const slotStart = lastBooking?.slotEnd ?? nowInMinutes; // If undefined, use nowInMinutes
  const slotEnd = slotStart + serviceDuration;

  // 6️⃣ Queue number
  const lastQueue = await Booking.findOne({
    vendor: owner.user,
    date: today,
  }).sort({ queueNumber: -1 });
  const queueNumber = lastQueue ? lastQueue.queueNumber! + 1 : 1;

  // 7️⃣ Create booking
  const booking = await Booking.create({
    vendor: owner.user,
    customer: null, // walk-in
    customerName,
    phone,
    email: '',
    service: getService._id,
    serviceType: SERVICE_MODEL_TYPE.OwnerService,
    bookingSource: 'walkin',
    queueNumber,
    date: today,
    time: now.toLocaleTimeString(),
    duration: getService.time,
    slotStart,
    slotEnd,
    totalPrice: getService.price,
    status: lastBooking ? 'waiting' : 'serving',
    dashboardStatus: lastBooking ? 'nextLine' : 'servicingNow',
    request: 'approved',
    isPaid: true,
    isDeleted: false,
  });

  return booking;
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

  const filter = {
    vendor: vendor as string,
    isDeleted: false,
    request: 'pending',
  };

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

const getBookingsHistoryByCustomerFromDB = async (
  userId: string,
  status: string,
) => {
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

const getBookingsHistoryByVendorFromDB = async (
  vendorId: string,
  status: string,
) => {
  // Validate vendor
  if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new AppError(400, 'Invalid Vendor ID');
  }

  // Validate status
  if (!status) {
    throw new AppError(400, 'Booking status is required');
  }

  const query = {
    vendor: vendorId,
    isDeleted: false,
    status: status, // status filter applies here
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
  // 1️⃣ Fetch booking with customer & vendor info
  const booking = await Booking.findById(id)
    .populate('customer', '_id email role fcmToken')
    .populate('vendor', '_id email role fcmToken');

  if (!booking) {
    throw new AppError(404, 'This booking is not found');
  }

  // 2️⃣ Update booking status
  const result = await Booking.findByIdAndUpdate(id, payload, { new: true });

  // 3️⃣ Send Notifications
  const customer = booking.customer as any;
  const vendor = booking.vendor as any;

  // Customer Notification
  if (customer?.fcmToken) {
    await sendNotification([customer.fcmToken], {
      title: 'Booking Completed',
      message: `Your booking for service ${booking.service} on ${booking.date} at ${booking.time} is completed!`,
      receiver: customer._id,
      receiverEmail: customer.email,
      receiverRole: customer.role,
      sender: vendor._id,
      type: 'booking',
    });
  }

  // Vendor Notification (optional)
  if (vendor?.fcmToken) {
    await sendNotification([vendor.fcmToken], {
      title: 'Booking Completed',
      message: `The booking from ${customer.email} on ${booking.date} at ${booking.time} is marked as completed.`,
      receiver: vendor._id,
      receiverEmail: vendor.email,
      receiverRole: vendor.role,
      sender: customer._id,
      type: 'booking',
    });
  }

  return result;
};

const bookingCanceledStatusIntoDB = async (
  id: string,
  payload: { status: string },
) => {
  // 1️⃣ Fetch booking with customer & vendor
  const booking = await Booking.findById(id)
    .populate('customer', '_id email role fcmToken')
    .populate('vendor', '_id email role fcmToken');

  if (!booking) {
    throw new AppError(404, 'This booking is not found');
  }

  // 2️⃣ Update booking status
  const result = await Booking.findByIdAndUpdate(id, payload, { new: true });

  // 3️⃣ Send Notifications
  const customer = booking.customer as any;
  const vendor = booking.vendor as any;

  // Customer Notification
  if (customer?.fcmToken) {
    await sendNotification([customer.fcmToken], {
      title: 'Booking Canceled',
      message: `Your booking for service ${booking.service} on ${booking.date} at ${booking.time} has been canceled.`,
      receiver: customer._id,
      receiverEmail: customer.email,
      receiverRole: customer.role,
      sender: vendor._id,
      type: 'booking',
    });
  }

  // Vendor Notification (optional)
  if (vendor?.fcmToken) {
    await sendNotification([vendor.fcmToken], {
      title: 'Booking Canceled',
      message: `The booking from ${customer.email} on ${booking.date} at ${booking.time} has been canceled.`,
      receiver: vendor._id,
      receiverEmail: vendor.email,
      receiverRole: vendor.role,
      sender: customer._id,
      type: 'booking',
    });
  }

  return result;
};

const bookingApprovedRequestIntoDB = async (
  id: string,
  payload: { request: 'approved' | 'pending' | 'decline' },
) => {
  // 1️⃣ Fetch booking with customer & vendor
  const booking = await Booking.findById(id)
    .populate('customer', '_id email role fcmToken')
    .populate('vendor', '_id email role fcmToken');

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

  // 3️⃣ Send Notifications
  const customer = booking.customer as any;
  const vendor = booking.vendor as any;

  // Customer Notification
  if (customer?.fcmToken) {
    await sendNotification([customer.fcmToken], {
      title: 'Booking Approved',
      message: `Your booking for service ${booking.service} on ${booking.date} at ${booking.time} has been approved.`,
      receiver: customer._id,
      receiverEmail: customer.email,
      receiverRole: customer.role,
      sender: vendor._id,
      type: 'booking',
    });
  }

  // Vendor Notification (optional)
  if (vendor?.fcmToken) {
    await sendNotification([vendor.fcmToken], {
      title: 'Booking Approved',
      message: `You approved the booking from ${customer.email} on ${booking.date} at ${booking.time}.`,
      receiver: vendor._id,
      receiverEmail: vendor.email,
      receiverRole: vendor.role,
      sender: customer._id,
      type: 'booking',
    });
  }

  return result;
};

const bookingDeclineRequestIntoDB = async (
  id: string,
  payload: { request: 'decline' | 'pending' | 'approved' },
) => {
  // 1️⃣ Fetch booking
  const booking = await Booking.findById(id)
    .populate('customer', '_id email role fcmToken')
    .populate('vendor', '_id email role fcmToken');

  if (!booking) {
    throw new AppError(404, 'This booking is not found');
  }

  // 2️⃣ Prevent declining an already approved booking (optional)
  if (booking.request === 'approved' && payload.request === 'decline') {
    throw new AppError(400, 'Cannot decline an already approved booking');
  }

  // 3️⃣ Update booking request field
  const result = await Booking.findByIdAndUpdate(id, payload, { new: true });

  // 4️⃣ Send Notifications
  const customer = booking.customer as any;
  const vendor = booking.vendor as any;

  // Customer Notification
  if (customer?.fcmToken) {
    await sendNotification([customer.fcmToken], {
      title: 'Booking Declined',
      message: `Your booking for service ${booking.service} on ${booking.date} at ${booking.time} has been declined.`,
      receiver: customer._id,
      receiverEmail: customer.email,
      receiverRole: customer.role,
      sender: vendor._id,
      type: 'booking',
    });
  }

  // Vendor Notification (optional)
  if (vendor?.fcmToken) {
    await sendNotification([vendor.fcmToken], {
      title: 'Booking Declined',
      message: `The booking request from ${customer.email} on ${booking.date} at ${booking.time} has been declined.`,
      receiver: vendor._id,
      receiverEmail: vendor.email,
      receiverRole: vendor.role,
      sender: customer._id,
      type: 'booking',
    });
  }

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

  const now = getCurrentMinutes(); // minutes from midnight

  // Fetch bookings
  const bookings = await Booking.find({
    vendor: vendorId,
    isDeleted: false,
    request: 'approved',
  })
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

  // If no bookings
  if (!bookings?.length) {
    return {
      servicingNow: [],
      nextLine: [],
      waitingToday: [],
      upcoming: [],
    };
  }

  // Final result containers
  const servicingNow: typeof bookings = [];
  const next: typeof bookings = []; // today's future bookings
  const upcoming: typeof bookings = [];

  bookings.forEach((b) => {
    const bookingDate = new Date(b.date);
    bookingDate.setHours(0, 0, 0, 0);

    const isToday = bookingDate.getTime() === today.getTime();

    // 1️⃣ Servicing Now (now inside the slot)
    if (
      isToday &&
      b.slotStart !== undefined &&
      b.slotEnd !== undefined &&
      b.slotStart <= now &&
      b.slotEnd >= now
    ) {
      servicingNow.push(b);
      return;
    }

    // 2️⃣ Next (Today's future bookings)
    if (isToday && b.slotStart !== undefined && b.slotStart > now) {
      next.push(b);
      return;
    }

    // 3️⃣ Upcoming (Future date bookings)
    if (bookingDate.getTime() > today.getTime()) {
      upcoming.push(b);
      return;
    }
  });

  // Sort next by earliest future booking
  next.sort((a: any, b: any) => a.slotStart - b.slotStart);

  // 4️⃣ Next Line = first 4
  const nextLine = next.slice(0, 4);

  // 5️⃣ Waiting Today = remaining today's future bookings
  const waitingToday = next.slice(4);

  return {
    servicingNow,
    nextLine,
    waitingToday,
    upcoming,
  };
};

const getBookingServicingNowPanelFromDB = async (
  query: Record<string, unknown>,
) => {
  const nowMinutes = getCurrentMinutes();
  const today = dayjs().startOf('day');

  // 🔥 1. Base Query (NO date filter here)
  const mongooseQuery = Booking.find({
    isDeleted: false,
    request: 'approved',
  })
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
    });

  const bookingQuery = new QueryBuilder(mongooseQuery, query)
    .search(bookingSearchableFields)
    .filter()
    .fields();

  const results = await bookingQuery.modelQuery;

  const finalList: any[] = [];

  for (const doc of results) {
    const booking = doc.toObject();
    const bookingDate = dayjs(booking.date);
    const start = booking.slotStart ?? -1;
    const end = booking.slotEnd ?? -1;

    // ❌ 1. Past date booking
    if (bookingDate.isBefore(today, 'day')) continue;

    // ❌ 2. Today but already finished
    if (bookingDate.isSame(today, 'day') && end < nowMinutes) {
      continue;
    }

    // ✅ 3. Servicing now
    if (
      bookingDate.isSame(today, 'day') &&
      start <= nowMinutes &&
      end >= nowMinutes
    ) {
      booking.dashboardStatus = 'servicingNow';
    }

    // ✅ 4. Next line (today future)
    else if (bookingDate.isSame(today, 'day') && start > nowMinutes) {
      booking.dashboardStatus = 'nextLine';
    }

    // ✅ 5. Upcoming (future date)
    else if (bookingDate.isAfter(today, 'day')) {
      booking.dashboardStatus = 'upcoming';
    } else {
      continue;
    }

    finalList.push(booking);
  }

  // 🔥 6. Smart Sorting (date first, then slot)
  finalList.sort((a, b) => {
    const dateDiff = dayjs(a.date).diff(dayjs(b.date));
    if (dateDiff !== 0) return dateDiff;
    return (a.slotStart ?? 0) - (b.slotStart ?? 0);
  });

  // 🔥 7. Pagination (Dashboard safe)
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const skip = (page - 1) * limit;

  return {
    meta: {
      page,
      limit,
      totalDoc: finalList.length,
      totalPage: Math.ceil(finalList.length / limit),
    },
    result: finalList.slice(skip, skip + limit),
  };
};

export const BookingServices = {
  createOnlineBookingIntoDB,
  createWalkInBookingIntoDB,
  getAllBookingsFromDB,
  getBookingsRequestFromDB,
  getBookingsHistoryByCustomerFromDB,
  getBookingsHistoryByVendorFromDB,
  getBookingByIdFromDB,
  bookingCompletedStatusIntoDB,
  bookingCanceledStatusIntoDB,
  bookingApprovedRequestIntoDB,
  bookingDeclineRequestIntoDB,
  getVendorAppHomeBookingsFromDB,
  getBookingServicingNowPanelFromDB,
};
