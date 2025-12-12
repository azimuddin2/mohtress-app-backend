import express from 'express';
import multer, { memoryStorage } from 'multer';
import auth from '../../middlewares/auth';
import { AnnouncementControllers } from './announcement.controller';

const router = express.Router();
const upload = multer({ storage: memoryStorage() });

router.post(
  '/',
  auth('admin'),
  upload.fields([{ name: 'images', maxCount: 1 }]),
  AnnouncementControllers.createAnnouncement,
);

router.get(
  '/',
  auth('admin', 'customer', 'freelancer', 'owner', 'sub-admin'),
  AnnouncementControllers.getAllAnnouncement,
);

router.delete(
  '/:id',
  auth('admin'),
  AnnouncementControllers.deleteAnnouncement,
);

export const AnnouncementRoutes = router;
