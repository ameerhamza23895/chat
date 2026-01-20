/**
 * Utility to handle disappearing message deletion
 * Can be used from both controllers and socket handlers
 */

const Message = require('../models/Message');
const logger = require('./logger');

/**
 * Delete disappearing messages that have been read
 * @param {Object} io - Socket.io instance (optional, for emitting events)
 * @param {Array} messageIds - Array of message IDs to check and delete
 * @returns {Array} Array of deleted message IDs
 */
const deleteDisappearingMessagesAfterRead = async (io, messageIds) => {
  try {
    if (!messageIds || messageIds.length === 0) {
      console.log('[MESSAGE DELETION] No message IDs provided');
      return [];
    }

    console.log('[MESSAGE DELETION] Checking messages for deletion:', messageIds.length, 'message IDs');

    // Find disappearing messages that have been read
    const disappearingMessages = await Message.find({
      _id: { $in: messageIds },
      isDisappearing: true,
      disappearAfterRead: true,
      isRead: true,
      isDeleted: false,
    });

    console.log('[MESSAGE DELETION] Found disappearing messages:', disappearingMessages.length);
    
    if (disappearingMessages.length === 0) {
      console.log('[MESSAGE DELETION] No disappearing messages found matching criteria');
      // Debug: Check what messages exist
      const allMessages = await Message.find({ _id: { $in: messageIds } }).select('_id isDisappearing disappearAfterRead isRead isDeleted');
      console.log('[MESSAGE DELETION] All messages found:', allMessages.map(m => ({
        id: m._id.toString(),
        isDisappearing: m.isDisappearing,
        disappearAfterRead: m.disappearAfterRead,
        isRead: m.isRead,
        isDeleted: m.isDeleted,
      })));
      return [];
    }

    const idsToDelete = disappearingMessages.map(msg => msg._id.toString());
    console.log('[MESSAGE DELETION] Deleting messages:', idsToDelete);

    // Mark as deleted
    await Message.updateMany(
      { _id: { $in: idsToDelete } },
      { isDeleted: true, deletedAt: new Date() }
    );

    console.log('[MESSAGE DELETION] ✅ Deleted', disappearingMessages.length, 'disappearing messages');
    logger.info('Deleted disappearing messages after read', { count: disappearingMessages.length });

    // Emit deletion events if io is provided
    if (io) {
      disappearingMessages.forEach(message => {
        // Convert ObjectIds to strings for room names
        const senderId = message.sender.toString();
        const receiverId = message.receiver.toString();
        const messageId = message._id.toString();
        
        const senderRoom = `user_${senderId}`;
        const receiverRoom = `user_${receiverId}`;
        
        console.log('[MESSAGE DELETION] Emitting message-deleted to:', senderRoom, 'and', receiverRoom);
        
        // Notify both users that message was deleted
        io.to(senderRoom).emit('message-deleted', {
          messageId: messageId,
          deletedAt: new Date(),
        });
        io.to(receiverRoom).emit('message-deleted', {
          messageId: messageId,
          deletedAt: new Date(),
        });
      });
      console.log('[MESSAGE DELETION] ✅ Emitted deletion events');
    } else {
      console.log('[MESSAGE DELETION] ⚠️ No io instance provided, cannot emit events');
    }

    return idsToDelete;
  } catch (error) {
    console.error('[MESSAGE DELETION] ❌ Error:', error.message);
    console.error('[MESSAGE DELETION] Stack:', error.stack);
    logger.error('Error deleting disappearing messages', { error: error.message });
    return [];
  }
};

module.exports = {
  deleteDisappearingMessagesAfterRead,
};
