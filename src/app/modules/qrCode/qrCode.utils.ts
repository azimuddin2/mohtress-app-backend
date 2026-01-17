import crypto from 'crypto';

export const generateQrToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

console.log(generateQrToken());
