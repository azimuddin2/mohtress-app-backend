import config from '../../config';
import AppError from '../../errors/AppError';
import { SERVICE_MODEL_TYPE } from '../booking/booking.interface';
import { Booking } from '../booking/booking.model';
import { OwnerRegistration } from '../ownerRegistration/ownerRegistration.model';
import { OwnerService } from '../ownerService/ownerService.model';
import { generateQrToken } from './qrCode.utils';
import QRCode from 'qrcode';

const generateQRCode = async (ownerId: string) => {
  const owner = await OwnerRegistration.findById(ownerId);
  if (!owner) {
    throw new AppError(404, 'Owner Registration not found');
  }

  if (!owner.qrToken) {
    owner.qrToken = generateQrToken();
    await owner.save();
  }

  const qrPayload = `${config.server_url}/walkin/${owner.qrToken}`;
  const qrImage = await QRCode.toDataURL(qrPayload);

  return {
    qrToken: owner.qrToken,
    qrImage,
    qrPayload,
  };
};

// Create walk-in booking
const createWalkInBookingIntoDB = async (payload: {
  qrToken: string;
  customerName: string;
  phone: string;
  serviceId: string;
}) => {
  const { qrToken, customerName, phone, serviceId } = payload;

  // 1️⃣ Validate QR
  const owner = await OwnerRegistration.findOne({ qrToken });
  if (!owner) {
    throw new AppError(404, 'Invalid QR code');
  }

  // 2️⃣ Get service
  const service = await OwnerService.findById(serviceId);
  if (!service) {
    throw new AppError(404, 'Service not found');
  }

  const serviceDuration = Number(service.time);
  if (isNaN(serviceDuration)) {
    throw new AppError(400, 'Invalid service duration');
  }

  // 3️⃣ Auto slot calculation
  const now = new Date();
  const slotStart = now.getHours() * 60 + now.getMinutes();
  const slotEnd = slotStart + serviceDuration;

  const today = now.toISOString().split('T')[0];

  // 4️⃣ Queue number
  const lastQueue = await Booking.findOne({
    vendor: owner.user,
    date: today,
    bookingSource: 'walkin',
  }).sort({ queueNumber: -1 });

  const queueNumber = lastQueue ? lastQueue.queueNumber! + 1 : 1;

  // 5️⃣ Calendar conflict check
  const conflict = await Booking.findOne({
    vendor: owner.user,
    date: today,
    isDeleted: false,
    slotStart: { $lt: slotEnd },
    slotEnd: { $gt: slotStart },
  });

  if (conflict) {
    throw new AppError(409, 'Stylist currently busy. Please wait.');
  }

  // 6️⃣ Create booking
  const booking = await Booking.create({
    vendor: owner.user,
    customer: null,

    service: service._id,
    serviceType: SERVICE_MODEL_TYPE.OwnerService,

    bookingSource: 'walkin',
    queueNumber,

    email: '',
    date: today,
    time: now.toLocaleTimeString(),
    duration: service.time, // ✅ string হিসেবেই রাখো

    slotStart,
    slotEnd,

    totalPrice: service.price,
    status: 'pending',
    request: 'approved',
    isPaid: true,
    isDeleted: false,
  });

  return booking;
};

export const QRCodeService = {
  generateQRCode,
  createWalkInBookingIntoDB,
};
