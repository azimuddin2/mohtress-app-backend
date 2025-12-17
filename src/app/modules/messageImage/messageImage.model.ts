import { model, Schema } from 'mongoose';
import { TMessageImage } from './messageImage.interface';

const messageImageSchema = new Schema<TMessageImage>(
  {
    url: { type: String, required: true },
    key: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export const MessageImage = model<TMessageImage>(
  'MessageImage',
  messageImageSchema,
);
