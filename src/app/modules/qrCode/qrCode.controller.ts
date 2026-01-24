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

const getWalkInDetailsByQRToken = catchAsync(async (req, res) => {
  const { qrToken } = req.params;
  const result = await QRCodeService.getWalkInDetailsByQRToken(qrToken);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Salon owner detail retrieved successfully',
    data: result,
  });
});

export const QRCodeController = {
  generateQR,
  getWalkInDetailsByQRToken,
};
