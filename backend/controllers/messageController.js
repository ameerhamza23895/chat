const Message = require('../models/Message');
const Chat = require('../models/Chat');
const cache = require('../utils/cache');
const logger = require('../utils/logger');
const { deleteDisappearingMessagesAfterRead } = require('../utils/messageDeletion');

// Store io instance (will be set from server.js)
let ioInstance = null;

// Function to set io instance from server
exports.setIoInstance = (io) => {
  ioInstance = io;
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, messageType, fileUrl, fileName, fileSize, mimeType } = req.body;
    const senderId = req.user.id;

    // Validate receiver exists
    if (senderId === receiverId) {
      return res.status(400).json({ success: false, message: 'Cannot send message to yourself' });
    }

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

    // Handle disappearing message settings
    const isDisappearing = req.body.isDisappearing || false;
    const disappearAfterRead = req.body.disappearAfterRead || false;
    const disappearInSeconds = req.body.disappearInSeconds || null; // e.g., 24 hours = 86400
    
    let disappearAt = null;
    if (isDisappearing && !disappearAfterRead && disappearInSeconds) {
      disappearAt = new Date(Date.now() + disappearInSeconds * 1000);
    }

    // Create message
    const message = await Message.create({
      sender: senderId,
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
    
    // Increment unread count for receiver
    const currentUnread = chat.unreadCount.get(receiverId.toString()) || 0;
    chat.unreadCount.set(receiverId.toString(), currentUnread + 1);
    
    await chat.save();

    // Clear cache
    await cache.del(`chats:${senderId}`);
    await cache.del(`chats:${receiverId}`);
    await cache.del(`messages:count:${senderId}:${receiverId}`);
    await cache.del(`messages:count:${receiverId}:${senderId}`);

    // Populate message with sender details
    await message.populate('sender', 'username avatar');
    await message.populate('receiver', 'username avatar');

    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    logger.error('Send message error', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 messages per page
    const beforeDate = req.query.beforeDate ? new Date(req.query.beforeDate) : null;
    
    console.log('[MESSAGE CONTROLLER] Get messages request:', { 
      userId, 
      currentUserId, 
      limit,
      beforeDate: beforeDate ? beforeDate.toISOString() : null,
    });
    logger.info('Get messages request', { 
      userId, 
      currentUserId, 
      limit,
      beforeDate: beforeDate ? beforeDate.toISOString() : null,
      query: req.query 
    });

    // Build base query for sender/receiver
    const baseQuery = {
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    };

    // If beforeDate is provided, get messages before that date (for pagination)
    if (beforeDate) {
      baseQuery.createdAt = { $lt: beforeDate };
    }

    // Try cache for total count (only for initial load)
    let totalCount;
    if (!beforeDate) {
      const cacheKey = `messages:count:${currentUserId}:${userId}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        totalCount = cached;
      } else {
        // Count all messages, excluding only explicitly deleted ones
        totalCount = await Message.countDocuments({
          $and: [
            {
              $or: [
                { sender: currentUserId, receiver: userId },
                { sender: userId, receiver: currentUserId },
              ],
            },
            {
              $or: [
                { isDeleted: { $ne: true } },
                { isDeleted: { $exists: false } },
              ],
            },
          ],
        });
        await cache.set(cacheKey, totalCount, 60); // Cache for 1 minute
      }
    } else {
      // Count all messages, excluding only explicitly deleted ones
      totalCount = await Message.countDocuments({
        $and: [
          {
            $or: [
              { sender: currentUserId, receiver: userId },
              { sender: userId, receiver: currentUserId },
            ],
          },
          {
            $or: [
              { isDeleted: { $ne: true } },
              { isDeleted: { $exists: false } },
            ],
          },
        ],
      });
    }

    // Build final query - combine base query with deletion filter
    // Only exclude messages that are explicitly deleted
    // Messages without isDeleted field (old messages) should be included
    const finalQuery = {
      $and: [
        {
          $or: [
            { sender: currentUserId, receiver: userId },
            { sender: userId, receiver: currentUserId },
          ],
        },
        {
          $or: [
            { isDeleted: { $ne: true } }, // Not explicitly deleted
            { isDeleted: { $exists: false } }, // Field doesn't exist (old messages)
          ],
        },
      ],
    };

    // Add createdAt filter if needed
    if (beforeDate) {
      finalQuery.$and.push({ createdAt: { $lt: beforeDate } });
    }

    console.log('[MESSAGE CONTROLLER] Final query:', JSON.stringify(finalQuery, null, 2));
    logger.info('Fetching messages with query', { 
      finalQuery: JSON.stringify(finalQuery),
      userId,
      currentUserId,
    });

    const messages = await Message.find(finalQuery)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: -1 }) // Sort descending to get newest first
      .limit(limit)
      .lean(); // Use lean() for better performance

    // Reverse to get oldest first for display
    const sortedMessages = messages.reverse();
    
    console.log('[MESSAGE CONTROLLER] Messages fetched:', sortedMessages.length);
    console.log('[MESSAGE CONTROLLER] First message:', sortedMessages[0] ? { 
      id: sortedMessages[0]._id?.toString(), 
      sender: sortedMessages[0].sender?.username,
      content: sortedMessages[0].content?.substring(0, 30) 
    } : 'No messages');
    
    logger.info('Messages fetched', { 
      count: sortedMessages.length,
      firstMessage: sortedMessages[0] ? { id: sortedMessages[0]._id, content: sortedMessages[0].content?.substring(0, 50) } : null,
      lastMessage: sortedMessages[sortedMessages.length - 1] ? { id: sortedMessages[sortedMessages.length - 1]._id, content: sortedMessages[sortedMessages.length - 1].content?.substring(0, 50) } : null,
    });

    // Mark messages as read (only for initial load, not pagination)
    if (!beforeDate) {
      const updateResult = await Message.updateMany(
        { sender: userId, receiver: currentUserId, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      if (updateResult.modifiedCount > 0) {
        // Get all messages that were just marked as read (including disappearing ones)
        const readMessages = await Message.find({
          sender: userId,
          receiver: currentUserId,
          isRead: true,
          readAt: { $gte: new Date(Date.now() - 5000) }, // Messages read in last 5 seconds
        }).select('_id');

        const messageIds = readMessages.map(msg => msg._id);

        console.log('[MESSAGE CONTROLLER] Messages marked as read:', messageIds.length);
        console.log('[MESSAGE CONTROLLER] ioInstance available:', !!ioInstance);

        // Handle disappearing messages that should be deleted after read
        if (messageIds.length > 0 && ioInstance) {
          console.log('[MESSAGE CONTROLLER] Calling deleteDisappearingMessagesAfterRead with', messageIds.length, 'message IDs');
          const deletedIds = await deleteDisappearingMessagesAfterRead(ioInstance, messageIds);
          console.log('[MESSAGE CONTROLLER] Deleted', deletedIds.length, 'disappearing messages');
        } else if (messageIds.length > 0 && !ioInstance) {
          console.warn('[MESSAGE CONTROLLER] ⚠️ ioInstance not available, cannot delete disappearing messages');
        }

        // Update chat unread count
        const chat = await Chat.findOne({
          participants: { $all: [currentUserId, userId] },
        });
        if (chat) {
          chat.unreadCount.set(currentUserId.toString(), 0);
          await chat.save();
        }

        // Clear cache
        await cache.del(`messages:count:${currentUserId}:${userId}`);
      }
    }

    console.log('[MESSAGE CONTROLLER] Sending response:', {
      messageCount: sortedMessages.length,
      totalCount,
      hasMore: beforeDate ? messages.length === limit : sortedMessages.length < totalCount,
    });
    
    logger.info('Get messages response', { 
      userId, 
      currentUserId, 
      messageCount: sortedMessages.length,
      totalCount,
      hasMore: beforeDate ? messages.length === limit : sortedMessages.length < totalCount,
      sampleMessage: sortedMessages[0] ? {
        id: sortedMessages[0]._id?.toString(),
        sender: sortedMessages[0].sender?.username || sortedMessages[0].sender?._id?.toString(),
        content: sortedMessages[0].content?.substring(0, 30),
        messageType: sortedMessages[0].messageType,
      } : null,
    });

    res.json({
      success: true,
      messages: sortedMessages,
      hasMore: beforeDate ? messages.length === limit : sortedMessages.length < totalCount,
      totalCount,
    });
    
    console.log('[MESSAGE CONTROLLER] Response sent successfully');
  } catch (error) {
    logger.error('Get messages error', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getChats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Try cache first
    const cacheKey = `chats:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        chats: cached,
      });
    }

    const chats = await Chat.find({
      participants: userId,
    })
      .populate('participants', 'username avatar isOnline lastSeen')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 })
      .lean(); // Use lean() for better performance

    // Cache for 30 seconds
    await cache.set(cacheKey, chats, 30);

    res.json({
      success: true,
      chats,
    });
  } catch (error) {
    logger.error('Get chats error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
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
