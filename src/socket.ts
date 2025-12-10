import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { TUser } from './app/modules/user/user.interface';
import { User } from './app/modules/user/user.model';
import { chatService } from './app/modules/chat/chat.service';
import { IChat } from './app/modules/chat/chat.interface';
import Chat from './app/modules/chat/chat.model';
import { Message } from './app/modules/message/message.model';
import AppError from './app/errors/AppError';
import getUserDetailsFromToken from './app/helpers/getUserDetailsFromToken';
import callbackFn from './app/utils/callbackFn';
import { sendNotification } from './app/modules/notification/notification.utils';

const initializeSocketIO = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  const socketTOUserId = new Map<string, string>();
  const userTOSocketId = new Map<string, string>();

  function getSocketId(userid: string) {
    return userTOSocketId.get(userid?.toString()) as string;
  }

  function getUserId(socketid: string) {
    return socketTOUserId.get(socketid?.toString()) as string;
  }

  // Online users
  const onlineUser = new Set();

  io.on('connection', async (socket) => {
    console.log('connected', socket?.id);

    try {
      //----------------------user token get from front end-------------------------//
      const token =
        socket.handshake.auth?.token || socket.handshake.headers?.token;
      //----------------------check Token and return user details-------------------------//
      const user: any = await getUserDetailsFromToken(token);

      if (!user) {
        // io.emit('io-error', {success:false, message:'invalid Token'});
        throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token');
      }

      socket.join(user?._id?.toString());

      //----------------------user id set in online array-------------------------//
      onlineUser.add(user?._id?.toString());
      socketTOUserId.set(socket?.id, user?._id?.toString());
      userTOSocketId.set(user?._id?.toString(), socket?.id);

      socket.on('check', (data, callback) => {
        console.log(data);

        callbackFn(callback, { success: true });
      });

      //----------------------online array send for front end------------------------//
      io.emit('onlineUser', Array.from(onlineUser));

      socket.on('message-page', async (data, callback) => {
        const { userId } = data;

        if (!userId) {
          callbackFn(callback, {
            success: false,
            message: 'userId is required',
          });
        }

        try {
          const receiverDetails: TUser | null = await User.findById(
            userId,
          ).select('_id email role image fullName');

          if (!receiverDetails) {
            callbackFn(callback, {
              success: false,
              message: 'user is not found!',
            });
            io.emit('io-error', {
              success: false,
              message: 'user is not found!',
            });
          }

          const payload = {
            _id: receiverDetails?._id,
            name: receiverDetails?.fullName,
            email: receiverDetails?.email,
            profile: receiverDetails?.image,
            role: receiverDetails?.role,
          };
          const userSocket = getSocketId(user?._id?.toString());

          io.to(userSocket).emit('user-details', payload);

          const getPreMessage = await Message.find({
            $or: [
              { sender: user?._id, receiver: userId },
              { sender: userId, receiver: user?._id },
            ],
          }).sort({ updatedAt: 1 });

          console.log(getPreMessage);
          io.to(userSocket).emit('message', getPreMessage || []);

          // Notification
          const allUnReaddMessage = await Message.countDocuments({
            receiver: user?._id,
            seen: false,
          });
          const variable = 'new-notifications::' + user?._id;
          io.emit(variable, allUnReaddMessage);

          const allUnReaddMessage2 = await Message.countDocuments({
            receiver: userId,
            seen: false,
          });
          const variable2 = 'new-notifications::' + userId;
          io.emit(variable2, allUnReaddMessage2);

          //end Notification//
        } catch (error: any) {
          callbackFn(callback, {
            success: false,
            message: error.message,
          });
          io.emit('io-error', { success: false, message: error });
          console.error('Error in message-page event:', error);
        }
      });

      //----------------------chat list------------------------//
      socket.on('my-chat-list', async (data, callback) => {
        try {
          const chatList = await chatService.getMyChatList(user?._id);
          const mySocketId = getSocketId(user?._id);

          io.to(mySocketId).emit('chat-list', chatList);

          callbackFn(callback, { success: true, message: chatList });
        } catch (error: any) {
          callbackFn(callback, {
            success: false,
            message: error.message,
          });
          io.emit('io-error', { success: false, message: error.message });
        }
      });

      //----------------------seen message-----------------------//
      socket.on('seen', async ({ chatId }, callback) => {
        if (!chatId) {
          callbackFn(callback, {
            success: false,
            message: 'chatId id is required',
          });
          io.emit('io-error', {
            success: false,
            message: 'chatId id is required',
          });
        }

        try {
          const chatList: IChat | null = await Chat.findById(chatId);
          if (!chatList) {
            callbackFn(callback, {
              success: false,
              message: 'chat id is not valid',
            });
            io.emit('io-error', {
              success: false,
              message: 'chat id is not valid',
            });
            throw new AppError(httpStatus.BAD_REQUEST, 'chat id is not valid');
          }

          const messageIdList = await Message.aggregate([
            {
              $match: {
                chat: new Types.ObjectId(chatId),
                seen: false,
                sender: { $ne: new Types.ObjectId(user?._id) },
              },
            },
            { $group: { _id: null, ids: { $push: '$_id' } } },
            { $project: { _id: 0, ids: 1 } },
          ]);
          const unseenMessageIdList =
            messageIdList.length > 0 ? messageIdList[0].ids : [];

          const updateMessages = await Message.updateMany(
            { _id: { $in: unseenMessageIdList } },
            { $set: { seen: true } },
          );

          const user1 = chatList.participants[0];
          const user2 = chatList.participants[1];
          // //----------------------ChatList------------------------//
          const ChatListUser1 = await chatService.getMyChatList(
            user1.toString(),
          );

          const ChatListUser2 = await chatService.getMyChatList(
            user2.toString(),
          );
          const user1SocketId = getSocketId(user1?.toString());
          const user2SocketId = getSocketId(user2?.toString());
          io.to(user1SocketId).emit('chat-list', ChatListUser1);
          io.to(user2SocketId).emit('chat-list', ChatListUser2);

          const allUnReaddMessage = await Message.countDocuments({
            receiver: user1,
            seen: false,
          });
          const variable = 'new-notifications::' + user1;
          io.emit(variable, allUnReaddMessage);

          const allUnReaddMessage2 = await Message.countDocuments({
            receiver: user2,
            seen: false,
          });
          const variable2 = 'new-notifications::' + user2;
          io.emit(variable2, allUnReaddMessage2);

          const getPreMessage = await Message.find({
            $or: [
              { sender: user1, receiver: user2 },
              { sender: user2, receiver: user1 },
            ],
          }).sort({ updatedAt: 1 });

          socket.emit('message', getPreMessage || []);
        } catch (error: any) {
          callbackFn(callback, {
            success: false,
            message: error.message,
          });
          console.error('Error in seen event:', error);
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('send-message', async (payload, callback) => {
        try {
          payload.sender = user?._id;

          const alreadyExists = await Chat.findOne({
            participants: { $all: [payload.sender, payload.receiver] },
          }).populate(['participants']);

          if (!alreadyExists) {
            const chatList = await Chat.create({
              participants: [payload.sender, payload.receiver],
            });

            payload.chat = chatList?._id;
          } else {
            payload.chat = alreadyExists?._id;
          }

          const result = await Message.create(payload);

          if (!result) {
            callbackFn(callback, {
              statusCode: httpStatus.BAD_REQUEST,
              success: false,
              message: 'Message sent failed',
            });
          }

          // const senderMessage = 'new-message::' + result.chat.toString();
          const userSocket = getSocketId(user?._id);
          const receiverSocket = getSocketId(result?.receiver?.toString());
          io.to(userSocket).emit('new-message', result);
          io.to(receiverSocket).emit('new-message', result);

          // //----------------------ChatList------------------------//

          const ChatListReceiver = await chatService.getMyChatList(
            result?.receiver.toString(),
          );

          io.to(receiverSocket).emit('chat-list', ChatListReceiver);

          const ChatListSender = await chatService.getMyChatList(
            result?.sender.toString(),
          );
          io.to(userSocket).emit('chat-list', ChatListSender);

          //  🔔 Send Firebase Notification
          // const receiverUser = await User.findById(result.receiver);
          // if (receiverUser?.fcmToken) {
          //   sendNotification([receiverUser.fcmToken], {
          //     title: `New Message`,
          //     message: payload.text || "You have a new message",
          //     receiver: receiverUser._id as any,
          //     receiverEmail: receiverUser.email,
          //     receiverRole: receiverUser.role,
          //     sender: payload.sender,
          //   });
          // }

          //end Notification//
          callbackFn(callback, {
            statusCode: httpStatus.OK,
            success: true,
            message: 'Message sent successfully!',
            data: result,
          });
        } catch (error: any) {
          callbackFn(callback, {
            statusCode: httpStatus.BAD_REQUEST,
            success: false,
            message:
              error?.message ?? 'server internal error for message sending',
          });
        }
      });

      //-----------------------Typing------------------------//
      // socket.on('typing', function (data) {
      //   const chat = 'typing::' + data.chatId.toString();
      //   const message = user?.name + ' is typing...';
      //   socket.emit(chat, { message: message });
      // });

      // socket.on('stopTyping', function (data) {
      //   const chat = 'stopTyping::' + data.chatId.toString();
      //   const message = user?.name + ' is stop typing...';
      //   socket.emit(chat, { message: message });
      // });

      //-----------------------Seen All------------------------//
      socket.on('message-notification', async ({}, callback) => {
        try {
          const allUnReaddMessage = await Message.countDocuments({
            receiver: user?._id,
            seen: false,
          });
          const variable = 'new-notifications::' + user?._id;
          io.emit(variable, allUnReaddMessage);
          callbackFn(callback, { success: true, message: allUnReaddMessage });
        } catch (error) {
          callbackFn(callback, {
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            success: false,
            message: 'Failed to retrieve notifications',
          });
        }
      });

      //-----------------------Disconnect------------------------//
      socket.on('disconnect', () => {
        onlineUser.delete(user?._id?.toString());
        socketTOUserId.delete(socket?.id);
        userTOSocketId.delete(user?._id);
        io.emit('onlineUser', Array.from(onlineUser));
        console.log('disconnect user ', socket.id);
      });
    } catch (error) {
      console.error('-- socket.io connection error --', error);
    }
  });

  return io;
};

export default initializeSocketIO;
