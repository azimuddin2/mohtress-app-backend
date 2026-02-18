import express from 'express';
import auth from '../../middlewares/auth';
import { WalletController } from './wallet.controller';

const router = express.Router();

router.get(
  '/earning-chart',
  auth('owner', 'freelancer'),
  WalletController.getYearlyEarningChart,
);

export const WalletRoute = router;
