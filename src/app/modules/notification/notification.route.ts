import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import { NotificationController } from './notification.controller';

const router = Router();

router.get(
  '/',
  auth(
    USER_ROLE.customer,
    USER_ROLE.owner,
    USER_ROLE.freelancer,
    USER_ROLE.admin,
  ),
  NotificationController.getAllNotification,
);

router.put(
  '/make-read/:id',
  auth(
    USER_ROLE.customer,
    USER_ROLE.owner,
    USER_ROLE.freelancer,
    USER_ROLE.admin,
  ),
  NotificationController.makeRead,
);

router.put(
  '/make-read-all',
  auth(
    USER_ROLE.customer,
    USER_ROLE.owner,
    USER_ROLE.freelancer,
    USER_ROLE.admin,
  ),
  NotificationController.makeReadAll,
);

router.get(
  '/admin-notifications',
  auth(USER_ROLE.admin),
  NotificationController.getAdminAllNotification,
);

router.post(
  '/push-notification',
  auth(
    USER_ROLE.customer,
    USER_ROLE.owner,
    USER_ROLE.freelancer,
    USER_ROLE.admin,
  ),
  NotificationController.pushNotificationUser,
);

export const NotificationRoutes = router;
