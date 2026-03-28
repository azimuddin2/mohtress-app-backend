import express from 'express';
import auth from '../../middlewares/auth';
import { WalletController } from './wallet.controller';

const router = express.Router();

router.get(
  '/earning-chart',
  auth('owner', 'freelancer'),
  WalletController.getYearlyEarningChart,
);

router.get(
  '/earning-summary',
  auth('owner', 'freelancer'),
  WalletController.getEarningsSummary,
);

export const WalletRoute = router;
