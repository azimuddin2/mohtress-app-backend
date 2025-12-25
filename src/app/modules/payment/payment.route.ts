import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import { PaymentController } from './payment.controller';

const router = Router();

router.get('/confirm-payment', PaymentController.confirmPayment);
router.get('/cancel', PaymentController.cancelPayment);

router.post(
  '/checkout',
  auth(USER_ROLE.customer),
  PaymentController.createPayment,
);

export const PaymentRoutes = router;
