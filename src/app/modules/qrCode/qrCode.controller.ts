import catchAsync from '../../utils/catchAsync';
import { QRCodeService } from './qrCode.service';

const generateQR = catchAsync(async (req, res) => {
  const ownerId = req.params.ownerId;
  const result = await QRCodeService.generateQRCode(ownerId);

  res.status(200).json({
    statusCode: 200,
    success: true,
    message: 'QR generated successfully',
    data: result,
  });
});

export const QRCodeController = {
  generateQR,
};
