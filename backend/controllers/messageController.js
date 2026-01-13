const Message = require('../models/Message');
const Chat = require('../models/Chat');

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, messageType, fileUrl, fileName, fileSize, mimeType } = req.body;
    const senderId = req.user.id;

    // Create or update chat
    let chat = await Chat.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!chat) {
      chat = await Chat.create({
        participants: [senderId, receiverId],
        unreadCount: new Map([[receiverId.toString(), 0]]),
      });
    }

    // Create message
    const message = await Message.create({
      sender: senderId,
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
    
    // Increment unread count for receiver
    const currentUnread = chat.unreadCount.get(receiverId.toString()) || 0;
    chat.unreadCount.set(receiverId.toString(), currentUnread + 1);
    
    await chat.save();

    // Populate message with sender details
    await message.populate('sender', 'username avatar');
    await message.populate('receiver', 'username avatar');

    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { sender: userId, receiver: currentUserId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    // Update chat unread count
    const chat = await Chat.findOne({
      participants: { $all: [currentUserId, userId] },
    });
    if (chat) {
      chat.unreadCount.set(currentUserId.toString(), 0);
      await chat.save();
    }

    res.json({
      success: true,
      messages,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getChats = async (req, res) => {
  try {
    const userId = req.user.id;

    const chats = await Chat.find({
      participants: userId,
    })
      .populate('participants', 'username avatar isOnline lastSeen')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    res.json({
      success: true,
      chats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.receiver.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
