import config from '../../config';
import AppError from '../../errors/AppError';
import { OwnerRegistration } from '../ownerRegistration/ownerRegistration.model';
import { generateQrToken } from './qrCode.utils';
import QRCode from 'qrcode';

const generateQRCode = async (ownerId: string) => {
  const owner = await OwnerRegistration.findById(ownerId);
  if (!owner) {
    throw new AppError(404, 'Owner Registration not found');
  }

  if (!owner.qrToken) {
    owner.qrToken = generateQrToken();
    await owner.save();
  }

  const qrPayload = `${config.server_url}/walkin/${owner.qrToken}`;
  const qrImage = await QRCode.toDataURL(qrPayload);

  return {
    qrToken: owner.qrToken,
    qrImage,
    qrPayload,
  };
};

export const QRCodeService = {
  generateQRCode,
};
