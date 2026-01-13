const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getChats,
  markAsRead,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.post('/send', protect, sendMessage);
router.get('/:userId', protect, getMessages);
router.get('/chats/all', protect, getChats);
router.put('/read/:messageId', protect, markAsRead);

module.exports = router;
