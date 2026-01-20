const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getChats,
  markAsRead,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const validators = require('../utils/validators');

router.post('/send', protect, messageLimiter, validate(validators.sendMessage), sendMessage);
router.get('/chats/all', protect, getChats);
router.get('/:userId', protect, validate(validators.getMessages), getMessages);
router.put('/read/:messageId', protect, validate(validators.markAsRead), markAsRead);

module.exports = router;
