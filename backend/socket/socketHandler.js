const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Chat = require('../models/Chat');

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
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date(),
    });

    // Join user's personal room
    socket.join(`user_${socket.userId}`);

    // Broadcast user online status
    socket.broadcast.emit('user-online', {
      userId: socket.userId,
      username: socket.username,
    });

    // Handle sending messages
    socket.on('send-message', async (data) => {
      try {
        const { receiverId, content, messageType, fileUrl, fileName, fileSize, mimeType } = data;

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

        // Create message
        const message = await Message.create({
          sender: socket.userId,
          receiver: receiverId,
          content,
          messageType: messageType || 'text',
          fileUrl: fileUrl || '',
          fileName: fileName || '',
          fileSize: fileSize || 0,
          mimeType: mimeType || '',
        });

        // Update chat
        chat.lastMessage = message._id;
        chat.lastMessageAt = message.createdAt;
        
        const currentUnread = chat.unreadCount.get(receiverId) || 0;
        chat.unreadCount.set(receiverId, currentUnread + 1);
        await chat.save();

        // Populate message
        await message.populate('sender', 'username avatar');
        await message.populate('receiver', 'username avatar');

        // Emit to receiver
        io.to(`user_${receiverId}`).emit('receive-message', message);
        
        // Emit confirmation to sender
        socket.emit('message-sent', message);
      } catch (error) {
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
        const message = await Message.findById(messageId);

        if (message && message.receiver.toString() === socket.userId) {
          message.isRead = true;
          message.readAt = new Date();
          await message.save();

          // Notify sender
          io.to(`user_${message.sender}`).emit('message-read', {
            messageId: message._id,
            readAt: message.readAt,
          });
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.username} (${socket.userId})`);

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      // Broadcast user offline status
      socket.broadcast.emit('user-offline', {
        userId: socket.userId,
        username: socket.username,
      });
    });
  });
};

module.exports = initializeSocket;
