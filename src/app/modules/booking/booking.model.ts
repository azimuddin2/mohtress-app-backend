import { Schema, model } from 'mongoose';
import {
  SERVICE_MODEL_TYPE,
  TAddOnService,
  TBooking,
} from './booking.interface';
import { BookingRequest, BookingStatus } from './booking.constant';

const addOnServiceSchema = new Schema<TAddOnService>(
  {
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }, // optional: don't create separate _id for each add-on
);

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true },
  },
  { _id: false },
);

const bookingSchema = new Schema<TBooking>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    customerName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },

    freelancerReg: {
      type: Schema.Types.ObjectId,
      ref: 'FreelancerRegistration',
    },
    ownerReg: {
      type: Schema.Types.ObjectId,
      ref: 'OwnerRegistration',
    },

    // Polymorphic service reference
    service: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'serviceType',
    },
    serviceType: {
      type: String,
      enum: Object.values(SERVICE_MODEL_TYPE),
      required: true,
    },

    // ✅ NEW — ONLINE / WALK-IN
    bookingSource: {
      type: String,
      enum: ['online', 'walkin'],
      default: 'online',
    },

    // ✅ NEW — Unified Queue Number
    queueNumber: {
      type: Number,
      default: null,
    },

    // ✅ NEW — QR Walk-in token reference
    qrToken: {
      type: String,
      default: null,
    },

    // Array of add-on services
    addOnServices: [addOnServiceSchema],

    email: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    specialist: {
      type: Schema.Types.ObjectId,
      ref: 'Specialist',
      required: false,
    },
    serviceLocation: {
      type: String,
      required: false,
    },
    images: {
      type: [imageSchema],
      required: true,
    },
    notes: {
      type: String,
      required: false,
    },
    totalPrice: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: BookingStatus,
      default: 'pending',
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    request: {
      type: String,
      enum: BookingRequest,
      default: 'pending',
    },

    slotStart: { type: Number },
    slotEnd: { type: Number },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Booking = model<TBooking>('Booking', bookingSchema);
