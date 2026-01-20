/**
 * Utility to handle disappearing messages cleanup
 * Runs periodically to delete messages that have expired
 */

const Message = require('../models/Message');
const logger = require('./logger');

const cleanupDisappearingMessages = async () => {
  try {
    const now = new Date();
    
    // Find messages that should be deleted based on time
    const expiredMessages = await Message.find({
      isDisappearing: true,
      disappearAfterRead: false,
      disappearAt: { $lte: now },
      isDeleted: false,
    });

    if (expiredMessages.length > 0) {
      const messageIds = expiredMessages.map(msg => msg._id);
      
      // Mark as deleted
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { isDeleted: true, deletedAt: now }
      );

      logger.info('Cleaned up disappearing messages', { count: expiredMessages.length });
      
      return messageIds;
    }
    
    return [];
  } catch (error) {
    logger.error('Error cleaning up disappearing messages', { error: error.message });
    return [];
  }
};

// Run cleanup every minute
const startCleanupInterval = () => {
  setInterval(async () => {
    await cleanupDisappearingMessages();
  }, 60 * 1000); // Every minute
  
  logger.info('Disappearing messages cleanup started');
};

module.exports = {
  cleanupDisappearingMessages,
  startCleanupInterval,
};
