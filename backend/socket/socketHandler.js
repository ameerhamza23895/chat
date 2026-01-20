const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const cache = require('../utils/cache');
const logger = require('../utils/logger');
const { deleteDisappearingMessagesAfterRead } = require('../utils/messageDeletion');

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.username = user.username;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

const initializeSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    logger.info('User connected', { userId: socket.userId, username: socket.username });

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date(),
    });

    // Clear user cache
    await cache.del(`user:${socket.userId}`);

    // Join user's personal room
    const userRoom = `user_${socket.userId}`;
    socket.join(userRoom);
    console.log(`[Socket] ✅ User ${socket.username} (${socket.userId}) joined room: ${userRoom}`);
    console.log(`[Socket] Socket ID: ${socket.id}`);
    
    // Verify room membership
    setTimeout(() => {
      const room = io.sockets.adapter.rooms.get(userRoom);
      if (room && room.has(socket.id)) {
        console.log(`[Socket] ✅ Verified: Socket ${socket.id} is in room ${userRoom}`);
      } else {
        console.warn(`[Socket] ⚠️ Warning: Socket ${socket.id} might not be in room ${userRoom}`);
      }
    }, 100);

    // Broadcast user online status
    socket.broadcast.emit('user-online', {
      userId: socket.userId,
      username: socket.username,
    });

    // Handle sending messages
    socket.on('send-message', async (data) => {
      try {
        const { receiverId, content, messageType, fileUrl, fileName, fileSize, mimeType } = data;

        // Validate receiver exists
        if (socket.userId === receiverId) {
          socket.emit('message-error', { message: 'Cannot send message to yourself' });
          return;
        }

        // Create or update chat
        let chat = await Chat.findOne({
          participants: { $all: [socket.userId, receiverId] },
        });

        if (!chat) {
          chat = await Chat.create({
            participants: [socket.userId, receiverId],
            unreadCount: new Map([[receiverId, 0]]),
          });
        }

        // Handle disappearing message settings
        const isDisappearing = data.isDisappearing || false;
        const disappearAfterRead = data.disappearAfterRead || false;
        const disappearInSeconds = data.disappearInSeconds || null;
        
        let disappearAt = null;
        if (isDisappearing && !disappearAfterRead && disappearInSeconds) {
          disappearAt = new Date(Date.now() + disappearInSeconds * 1000);
        }

        // Create message
        const message = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          content: content || '',
          messageType: messageType || 'text',
          fileUrl: fileUrl || '',
          fileName: fileName || '',
          fileSize: fileSize || 0,
          mimeType: mimeType || '',
          isDisappearing: isDisappearing,
          disappearAfterRead: disappearAfterRead,
          disappearAt: disappearAt,
        });

        // Update chat
        chat.lastMessage = message._id;
        chat.lastMessageAt = message.createdAt;
        
        const currentUnread = chat.unreadCount.get(receiverId) || 0;
        chat.unreadCount.set(receiverId, currentUnread + 1);
        await chat.save();

        // Clear cache
        await cache.del(`chats:${socket.userId}`);
        await cache.del(`chats:${receiverId}`);
        await cache.del(`messages:count:${socket.userId}:${receiverId}`);
        await cache.del(`messages:count:${receiverId}:${socket.userId}`);

        // Populate message
        await message.populate('sender', 'username avatar');
        await message.populate('receiver', 'username avatar');

        // Emit to receiver
        io.to(`user_${receiverId}`).emit('receive-message', message);
        
        // Emit confirmation to sender
        socket.emit('message-sent', message);
      } catch (error) {
        logger.error('Send message socket error', { error: error.message, userId: socket.userId });
        socket.emit('message-error', { message: error.message });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      socket.to(`user_${data.receiverId}`).emit('user-typing', {
        userId: socket.userId,
        username: socket.username,
        isTyping: data.isTyping,
      });
    });

    // Handle read receipt
    socket.on('mark-read', async (data) => {
      try {
        const { messageId } = data;
        console.log('[Socket] mark-read event received for message:', messageId);
        const message = await Message.findById(messageId);

        if (message && message.receiver.toString() === socket.userId) {
          console.log('[Socket] Marking message as read:', messageId);
          message.isRead = true;
          message.readAt = new Date();
          await message.save();

          // Handle disappearing messages that should be deleted after read
          console.log('[Socket] Checking if message should be deleted (disappearing):', {
            isDisappearing: message.isDisappearing,
            disappearAfterRead: message.disappearAfterRead,
            isRead: message.isRead,
          });
          await deleteDisappearingMessagesAfterRead(io, [message._id]);

          // Notify sender
          const senderId = message.sender.toString();
          io.to(`user_${senderId}`).emit('message-read', {
            messageId: message._id,
            readAt: message.readAt,
          });
        } else {
          console.log('[Socket] Message not found or not authorized to mark as read');
        }
      } catch (error) {
        console.error('[Socket] ❌ Error marking message as read:', error.message);
        logger.error('Error marking message as read', { error: error.message });
      }
    });

    // Handle initiate call (notify receiver)
    socket.on('initiate-call', (data) => {
      try {
        const { receiverId, callType } = data;
        console.log(`[Socket] ========== CALL INITIATED ==========`);
        console.log(`[Socket] Caller: ${socket.username} (${socket.userId})`);
        console.log(`[Socket] Receiver ID: ${receiverId}`);
        console.log(`[Socket] Call Type: ${callType}`);
        
        // Convert receiverId to string to ensure matching
        const receiverIdStr = String(receiverId);
        const targetRoom = `user_${receiverIdStr}`;
        
        console.log(`[Socket] Target room: ${targetRoom}`);
        
        // Check if receiver is in the room
        const room = io.sockets.adapter.rooms.get(targetRoom);
        console.log(`[Socket] Users in room ${targetRoom}:`, room ? room.size : 0);
        if (room) {
          console.log(`[Socket] Socket IDs in room:`, Array.from(room));
        } else {
          console.warn(`[Socket] ⚠️ Room ${targetRoom} does not exist - user might not be connected`);
        }
        
        // Get caller user info from database for better data
        User.findById(socket.userId).then(async (callerUser) => {
          const caller = callerUser ? {
            _id: callerUser._id.toString(),
            username: callerUser.username,
            avatar: callerUser.avatar,
          } : {
            _id: socket.userId.toString(),
            username: socket.username,
          };

          const callData = {
            caller,
            callType,
            callerId: socket.userId.toString(),
          };

          console.log(`[Socket] Sending incoming-call to room: ${targetRoom}`);
          console.log(`[Socket] Call data:`, JSON.stringify(callData, null, 2));

          // Save call history when call is initiated (appears for both users)
          try {
            // Find or create chat
            let chat = await Chat.findOne({
              participants: { $all: [socket.userId, receiverIdStr] },
            });

            if (!chat) {
              chat = await Chat.create({
                participants: [socket.userId, receiverIdStr],
                unreadCount: new Map(),
              });
            }

            // Determine message type based on call type
            const messageType = callType === 'video' ? 'call-video-ended' : 'call-audio-ended';
            
            // Create call history message (appears for both users)
            const callMessage = await Message.create({
              sender: socket.userId,
              receiver: receiverIdStr,
              content: `${callType.charAt(0).toUpperCase() + callType.slice(1)} call`,
              messageType: messageType,
            });

            // Update chat
            chat.lastMessage = callMessage._id;
            chat.lastMessageAt = callMessage.createdAt;
            await chat.save();

            // Populate message
            await callMessage.populate('sender', 'username avatar');
            await callMessage.populate('receiver', 'username avatar');

            // Emit call history to both users
            console.log('[Socket] 📨 Emitting call history message to caller:', socket.userId);
            console.log('[Socket] 📨 Emitting call history message to receiver:', receiverIdStr);
            io.to(`user_${socket.userId}`).emit('receive-message', callMessage);
            io.to(`user_${receiverIdStr}`).emit('receive-message', callMessage);
            console.log('[Socket] ✅ Call history messages emitted');
          } catch (msgError) {
            console.error('[Socket] ❌ Error saving call history:', msgError);
            console.error('[Socket] Error stack:', msgError.stack);
            // Don't block call initiation if history save fails
          }

          // Check room membership before emitting
          const room = io.sockets.adapter.rooms.get(targetRoom);
          if (!room || room.size === 0) {
            console.error(`[Socket] ❌ ERROR: Room ${targetRoom} is empty or doesn't exist!`);
            console.error(`[Socket] Receiver ${receiverIdStr} is not connected or not in room`);
            console.error(`[Socket] Available rooms:`, Array.from(io.sockets.adapter.rooms.keys()).filter(r => r.startsWith('user_')));
            
            // Try to find the user's actual room
            const allRooms = Array.from(io.sockets.adapter.rooms.keys());
            const userRooms = allRooms.filter(r => r.startsWith('user_'));
            console.log(`[Socket] All user rooms:`, userRooms);
          } else {
            console.log(`[Socket] ✅ Room ${targetRoom} exists with ${room.size} socket(s)`);
            console.log(`[Socket] Socket IDs in room:`, Array.from(room));
          }

          // Notify receiver of incoming call
          io.to(targetRoom).emit('incoming-call', callData);
          
          // Also try emitting to all sockets as a fallback (for debugging)
          console.log(`[Socket] Also broadcasting to all sockets for debugging...`);
          io.emit('incoming-call-broadcast', {
            ...callData,
            targetRoom,
            receiverId: receiverIdStr,
          });
          
          console.log(`[Socket] ✅ Call notification sent`);
          console.log(`[Socket] ======================================`);
        }).catch(err => {
          console.error('[Socket] Error fetching caller user:', err);
          // Fallback to basic caller info
          const caller = {
            _id: socket.userId.toString(),
            username: socket.username,
          };
          const callData = {
            caller,
            callType,
            callerId: socket.userId.toString(),
          };
          console.log(`[Socket] Using fallback caller data, sending to ${targetRoom}`);
          io.to(targetRoom).emit('incoming-call', callData);
        });
      } catch (error) {
        console.error('[Socket] ❌ Error initiating call:', error);
        console.error('[Socket] Error stack:', error.stack);
      }
    });

    // Handle call-user (send WebRTC offer)
    socket.on('call-user', (data) => {
      try {
        const { receiverId, callType, offer } = data;
        
        // Forward offer to receiver
        io.to(`user_${receiverId}`).emit('offer', {
          offer,
          callerId: socket.userId,
          callType,
        });
      } catch (error) {
        console.error('Error calling user:', error);
      }
    });

    // Handle answer-call (send WebRTC answer)
    socket.on('answer-call', (data) => {
      try {
        const { callerId, answer } = data;
        
        // Forward answer to caller
        io.to(`user_${callerId}`).emit('answer', {
          answer,
          receiverId: socket.userId,
        });

        // Notify caller that call was accepted
        io.to(`user_${callerId}`).emit('call-accepted', {
          receiverId: socket.userId,
        });
      } catch (error) {
        console.error('Error answering call:', error);
      }
    });

    // Handle accept-call (when user clicks answer button)
    socket.on('accept-call', (data) => {
      try {
        const { callerId } = data;
        
        // Notify caller that call was accepted
        io.to(`user_${callerId}`).emit('call-answered', {
          receiverId: socket.userId,
        });
      } catch (error) {
        console.error('Error accepting call:', error);
      }
    });

    // Handle reject-call
    socket.on('reject-call', async (data) => {
      try {
        const { callerId } = data;
        
        // Save call history when call is rejected
        try {
          // Find or create chat
          let chat = await Chat.findOne({
            participants: { $all: [socket.userId, callerId] },
          });

          if (!chat) {
            chat = await Chat.create({
              participants: [socket.userId, callerId],
              unreadCount: new Map(),
            });
          }

          // Create call history message (call missed/rejected)
          const callMessage = await Message.create({
            sender: callerId,
            receiver: socket.userId,
            content: 'Call missed',
            messageType: 'call-missed',
          });

          // Update chat
          chat.lastMessage = callMessage._id;
          chat.lastMessageAt = callMessage.createdAt;
          await chat.save();

          // Populate message
          await callMessage.populate('sender', 'username avatar');
          await callMessage.populate('receiver', 'username avatar');

          // Emit call history to both users
          io.to(`user_${socket.userId}`).emit('receive-message', callMessage);
          io.to(`user_${callerId}`).emit('receive-message', callMessage);
        } catch (msgError) {
          console.error('Error saving call rejection history:', msgError);
          // Don't block call rejection if history save fails
        }
        
        // Notify caller that call was rejected
        io.to(`user_${callerId}`).emit('call-rejected', {
          receiverId: socket.userId,
        });
      } catch (error) {
        console.error('Error rejecting call:', error);
      }
    });

    // Handle end-call
    socket.on('end-call', async (data) => {
      try {
        const { receiverId, callType, duration } = data;
        
        // Save call history for both users
        try {
          // Find or create chat
          let chat = await Chat.findOne({
            participants: { $all: [socket.userId, receiverId] },
          });

          if (!chat) {
            chat = await Chat.create({
              participants: [socket.userId, receiverId],
              unreadCount: new Map(),
            });
          }

          // Determine message type based on call type
          const messageType = callType === 'video' ? 'call-video-ended' : 'call-audio-ended';
          
          // Format duration (duration is in seconds)
          const minutes = Math.floor((duration || 0) / 60);
          const seconds = (duration || 0) % 60;
          const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          
          // Create call history message
          const callMessage = await Message.create({
            sender: socket.userId,
            receiver: receiverId,
            content: `Call ended • ${durationText}`,
            messageType: messageType,
          });

          // Update chat
          chat.lastMessage = callMessage._id;
          chat.lastMessageAt = callMessage.createdAt;
          await chat.save();

          // Populate message
          await callMessage.populate('sender', 'username avatar');
          await callMessage.populate('receiver', 'username avatar');

          // Emit call history message to both users
          console.log('[Socket] 📨 Emitting call end history to caller:', socket.userId);
          console.log('[Socket] 📨 Emitting call end history to receiver:', receiverId);
          io.to(`user_${socket.userId}`).emit('receive-message', callMessage);
          io.to(`user_${receiverId}`).emit('receive-message', callMessage);
          console.log('[Socket] ✅ Call end history messages emitted');
        } catch (msgError) {
          console.error('[Socket] ❌ Error saving call history:', msgError);
          console.error('[Socket] Error stack:', msgError.stack);
          // Don't block call ending if history save fails
        }
        
        // Notify receiver that call ended
        io.to(`user_${receiverId}`).emit('call-ended', {
          callerId: socket.userId,
        });
      } catch (error) {
        console.error('Error ending call:', error);
      }
    });

    // Handle ICE candidate exchange
    socket.on('ice-candidate', (data) => {
      try {
        const { receiverId, candidate } = data;
        
        // Forward ICE candidate to receiver
        io.to(`user_${receiverId}`).emit('ice-candidate', {
          candidate,
          senderId: socket.userId,
        });
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      logger.info('User disconnected', { userId: socket.userId, username: socket.username });

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      // Clear user cache
      await cache.del(`user:${socket.userId}`);

      // Broadcast user offline status
      socket.broadcast.emit('user-offline', {
        userId: socket.userId,
        username: socket.username,
      });
    });
  });
};

module.exports = initializeSocket;
