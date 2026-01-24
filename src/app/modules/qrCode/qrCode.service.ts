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

  const qrPayload = `${config.client_Url}/salon?qrToken=${owner.qrToken}`;
  const qrImage = await QRCode.toDataURL(qrPayload);

  return {
    qrToken: owner.qrToken,
    qrImage,
  };
};

const getWalkInDetailsByQRToken = async (qrToken: string) => {
  const owner = await OwnerRegistration.findOne({ qrToken }).populate(
    'services',
  );

  if (!owner) {
    throw new AppError(404, 'Invalid or Expired QR Token');
  }

  return owner;
};

export const QRCodeService = {
  generateQRCode,
  getWalkInDetailsByQRToken,
};
