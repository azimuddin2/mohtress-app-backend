import jwt, { Secret } from 'jsonwebtoken';
import { TJwtPayload } from './auth.interface';
import firebaseAdmin from '../../utils/firebase';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

export const createToken = (
  jwtPayload: TJwtPayload,
  secret: Secret,
  expiresIn: any,
) => {
  return jwt.sign(jwtPayload, secret, { expiresIn });
};

export const isValidFcmToken = async (token: string) => {
  try {
    await firebaseAdmin.messaging().send({
      token,
      notification: {
        title: 'Login Alert!',
        body: 'New Device Login Successfully!',
      },
    });
    return true;
  } catch (err: any) {
    console.error('FCM validation error:', err.code, err.message); // log for debugging
    if (
      err.code === 'messaging/invalid-registration-token' ||
      err.code === 'messaging/registration-token-not-registered'
    ) {
      return false;
    }
    return false;
  }
};

export const verifyAppleToken = async (token: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
      },
      (err, decoded) => {
        if (err) {
          return reject(
            new AppError(httpStatus.BAD_REQUEST, 'Invalid Apple token'),
          );
        }
        resolve(decoded);
      },
    );
  });
};
