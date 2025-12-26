import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import { PaymentController } from './payment.controller';

const router = Router();

router.post(
  '/checkout',
  auth(USER_ROLE.customer),
  PaymentController.createPayment,
);

router.get('/confirm-payment', PaymentController.confirmPayment);
router.get('/cancel', PaymentController.cancelPayment);

export const PaymentRoutes = router;
