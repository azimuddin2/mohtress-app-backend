import mongoose, { Schema } from 'mongoose';
import { IReferred } from './referred.interface';

const referredSchema = new Schema<IReferred>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
    },
    limit: {
      type: Number,
      default: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Referred = mongoose.model<IReferred>('Referred', referredSchema);
