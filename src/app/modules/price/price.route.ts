import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { PriceController } from './price.controller';
import { PriceValidation } from './price.validation';

const router = express.Router();

router.get('/', PriceController.getPrice);

router.put(
  '/',
  auth('admin'),
  validateRequest(PriceValidation.priceValidationSchema),
  PriceController.upsertPrice,
);

export const PriceRoutes = router;
