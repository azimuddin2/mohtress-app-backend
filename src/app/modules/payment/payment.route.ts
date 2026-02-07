import { Router } from 'express';
import auth from '../../middlewares/auth';
import { PaymentController } from './payment.controller';

const router = Router();

router.post('/checkout', PaymentController.createPayment);

router.get('/confirm-payment', PaymentController.confirmPayment);
router.get('/cancel', PaymentController.cancelPayment);

router.get(
  '/transactions',
  auth('admin', 'sub-admin'),
  PaymentController.getAllPayments,
);

router.get(
  '/transactions/:id',
  auth('admin', 'sub-admin'),
  PaymentController.getPaymentById,
);

export const PaymentRoutes = router;
