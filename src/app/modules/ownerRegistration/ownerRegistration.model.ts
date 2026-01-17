import { model, Schema } from 'mongoose';
import { TOwnerRegistration } from './ownerRegistration.interface';
import { ApprovalStatus } from './ownerRegistration.constant';

const OpeningHourSchema = new Schema(
  {
    enabled: { type: Boolean, required: true, default: true },
    day: { type: String, required: true },
    openTime: { type: String, required: true },
    closeTime: { type: String, required: true },
  },
  { _id: false },
);

const OwnerRegistrationSchema = new Schema<TOwnerRegistration>(
  {
    user: {
      type: Schema.Types.ObjectId,
      required: [true, 'User Id is required'],
      ref: 'User',
    },
    salonName: {
      type: String,
      required: true,
    },
    about: {
      type: String,
      required: true,
    },
    idDocument: {
      type: String,
      required: [true, 'ID Document is required'],
    },
    businessRegistration: {
      type: String,
      required: [true, 'Business Registration is required'],
    },
    salonFrontPhoto: {
      type: String,
      required: [true, 'Salon front photo is required'],
    },
    salonInsidePhoto: {
      type: String,
      required: [true, 'Salon inside photo is required'],
    },
    openingHours: {
      type: [OpeningHourSchema],
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: {
        values: ApprovalStatus,
        message: '{VALUE} is not valid',
      },
      default: 'pending',
    },
    notes: {
      type: String,
      default: null,
    },
    salonPhoto: {
      type: String,
      default: null,
    },
    businessRegistrationNumber: {
      type: Number,
      default: null,
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      streetAddress: { type: String },
    },

    services: [
      {
        type: Schema.Types.ObjectId,
        ref: 'OwnerService',
      },
    ],
    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Review',
      },
    ],
    avgRating: {
      type: Number,
      default: 0,
    },

    qrToken: {
      type: String,
      default: null,
    },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

export const OwnerRegistration = model<TOwnerRegistration>(
  'OwnerRegistration',
  OwnerRegistrationSchema,
);
