import admin from 'firebase-admin';
import httpStatus from 'http-status';
import Notification from './notification.model';
import { INotification } from './notification.interface';
import AppError from '../../errors/AppError';

// Initialize Firebase Admin SDK only if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      './firebase.json' as admin.ServiceAccount,
    ),
  });
}

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert({
//       projectId: process.env.FIREBASE_PROJECT_ID,
//       privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     } as admin.ServiceAccount),
//   });
// }

export const sendNotification = async (
  fcmToken: string[],
  payload: INotification,
): Promise<unknown> => {
  // console.log('sendNotification', payload);

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmToken,
      notification: {
        title: payload.title,
        body: payload.message,
      },
      // android: {
      //   notification: {
      //     icon: 'http://10.10.10.5:4000/logo.png',
      //     imageUrl: 'http://10.10.10.5:4000/logo.png',
      //     clickAction: 'notification',
      //   },
      // },
      apns: {
        headers: {
          'apns-push-type': 'alert',
          'apns-priority': '10',
        },
        // fcmOptions: {
        //   imageUrl: 'http://10.10.10.5:4000/logo.png',
        // },
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.message,
            },
            badge: 1,
            sound: 'default',
          },
        },
      },
      // webpush: {
      //   headers: {
      //     image: 'http://10.10.10.5:4000/logo.png',
      //   },
      // },
    });

    console.log('sendNotification response___', response);

    // If notifications were successfully sent, log them in the database
    if (response?.successCount > 0) {
      await Promise.all(
        fcmToken.map((token) =>
          Notification.create({
            sender: payload?.sender,
            receiver: payload?.receiver,
            receiverEmail: payload?.receiverEmail,
            receiverRole: payload?.receiverRole,
            title: payload.title,
            link: payload?.link || null,
            message: payload?.message,
            type: payload?.type || 'text',
          }),
        ),
      );
    }

    // Log any individual token failures
    if (response?.failureCount > 0) {
      response.responses.forEach((res: any, index: any) => {
        if (!res.success) {
          console.error(
            `FCM error for token at index ${index}: ${JSON.stringify(
              res.error,
            )}`,
          );
        }
      });
    }

    return response;
  } catch (error: any) {
    // Handle specific Firebase third-party auth error
    if (error?.code === 'messaging/third-party-auth-error') {
      console.warn('FCM auth error:', error.message);
      return null;
    }

    // General error handling
    console.error('Error sending FCM message:', error);
    throw new AppError(
      httpStatus.NOT_IMPLEMENTED,
      error.message || 'Failed to send notification',
    );
  }
};

export const sendMultipleNotification = async (
  fcmToken: string[],
  payload: INotification[],
  { title, message }: { title: string; message: string },
): Promise<unknown> => {
  try {
    if (fcmToken.length <= 0) {
      throw new AppError(httpStatus.NOT_FOUND, 'Token not sent');
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmToken,
      notification: {
        title: title,
        body: message,
      },
      android: {
        notification: {
          icon: 'http://10.10.10.5:4000/logo.png',
          imageUrl: 'http://10.10.10.5:4000/logo.png',
          clickAction: 'notification',
        },
      },
      apns: {
        headers: {
          'apns-push-type': 'alert',
        },
        fcmOptions: {
          imageUrl: 'http://10.10.10.5:4000/logo.png',
        },
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
      webpush: {
        headers: {
          image: 'http://10.10.10.5:4000/logo.png',
        },
      },
    });

    // If notifications were successfully sent, log them in the database
    if (response?.successCount > 0) {
      await Notification.insertMany(payload);
    }

    // Log any individual token failures
    if (response?.failureCount > 0) {
      response.responses.forEach((res: any, index: any) => {
        if (!res.success) {
          console.error(
            `FCM error for token at index ${index}: ${JSON.stringify(
              res.error,
            )}`,
          );
        }
      });
    }

    return response;
  } catch (error: any) {
    // Handle specific Firebase third-party auth error
    if (error?.code === 'messaging/third-party-auth-error') {
      console.warn('FCM auth error:', error.message);
      return null;
    }

    // General error handling
    console.error('Error sending FCM message:', error);
    throw new AppError(
      httpStatus.NOT_IMPLEMENTED,
      error.message || 'Failed to send notification',
    );
  }
};
