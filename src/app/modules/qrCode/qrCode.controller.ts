import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { QRCodeService } from './qrCode.service';

const generateQR = catchAsync(async (req, res) => {
  const ownerId = req.params.ownerId;
  const result = await QRCodeService.generateQRCode(ownerId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'QR generated successfully',
    data: result,
  });
});

const createWalkInBooking = catchAsync(async (req, res) => {
  const result = await QRCodeService.createWalkInBookingIntoDB(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Walk-in booking created successfully',
    data: result,
  });
});

export const QRCodeController = {
  generateQR,
  createWalkInBooking,
};
