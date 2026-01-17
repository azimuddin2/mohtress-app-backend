import express from 'express';
import auth from '../../middlewares/auth';
import { QRCodeController } from './qrCode.controller';

const router = express.Router();

router.get('/generate/:ownerId', auth('owner'), QRCodeController.generateQR);

export const QRCodeRoutes = router;
