import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { UserValidations } from './user.validation';
import { UserControllers } from './user.controller';
import auth from '../../middlewares/auth';
import multer, { memoryStorage } from 'multer';

const router = express.Router();
const upload = multer({ storage: memoryStorage() });

router.post(
  '/customer/signup',
  validateRequest(UserValidations.createUserValidationSchema),
  UserControllers.signupCustomer,
);

router.post(
  '/owner/signup',
  validateRequest(UserValidations.createUserValidationSchema),
  UserControllers.signupOwner,
);

router.post(
  '/freelancer/signup',
  validateRequest(UserValidations.createUserValidationSchema),
  UserControllers.signupFreelancer,
);

router.get('/', auth('admin'), UserControllers.getAllUsers);

router.get(
  '/profile',
  auth('admin', 'customer', 'freelancer', 'owner'),
  UserControllers.getUserProfile,
);

router.patch(
  '/profile',
  auth('admin', 'customer', 'owner', 'freelancer'),
  validateRequest(UserValidations.updateUserValidationSchema),
  UserControllers.updateUserProfile,
);

router.patch(
  '/profile/picture',
  auth('admin', 'customer', 'freelancer', 'owner'),
  upload.single('profile'),
  UserControllers.updateUserPicture,
);

router.put(
  '/change-status/:id',
  auth('admin'),
  validateRequest(UserValidations.changeStatusValidationSchema),
  UserControllers.changeStatus,
);

router.delete(
  '/',
  auth('customer', 'freelancer', 'owner'),
  UserControllers.deleteUserAccount,
);

router.patch(
  '/update-notifications',
  auth('admin', 'customer', 'freelancer', 'owner'),
  validateRequest(UserValidations.notificationSettingsValidationSchema),
  UserControllers.updateNotificationSettings,
);

export const UserRoutes = router;
