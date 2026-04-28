import mongoose, { Schema } from 'mongoose';
import { TPrice } from './price.interface';

const priceSchema = new Schema<TPrice>(
  {
    price: {
      type: Number,
      required: [true, 'Price is required'],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const Price = mongoose.model<TPrice>('Price', priceSchema);
