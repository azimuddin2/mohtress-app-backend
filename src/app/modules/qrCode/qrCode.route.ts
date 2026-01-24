import express from 'express';
import auth from '../../middlewares/auth';
import { QRCodeController } from './qrCode.controller';

const router = express.Router();

router.get('/generate/:ownerId', auth('owner'), QRCodeController.generateQR);

router.get('/salon/:qrToken', QRCodeController.getWalkInDetailsByQRToken);

export const QRCodeRoutes = router;
