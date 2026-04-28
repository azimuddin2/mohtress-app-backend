import AppError from '../../errors/AppError';
import { TPrice } from './price.interface';
import { Price } from './price.model';

// Get price (always single doc)
const getPriceFromDB = async () => {
  const result = await Price.findOne({ isDeleted: false });
  return result;
};

// Create/Update price (upsert)
const upsertPriceIntoDB = async (payload: TPrice) => {
  const result = await Price.findOneAndUpdate(
    {}, // empty filter → only one doc
    { ...payload, isDeleted: false },
    { new: true, upsert: true, runValidators: true },
  );

  if (!result) {
    throw new AppError(400, 'Failed to save price');
  }
  return result;
};

export const PriceService = {
  getPriceFromDB,
  upsertPriceIntoDB,
};
