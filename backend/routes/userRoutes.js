const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateAvatar,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/all', protect, getAllUsers);
router.get('/:id', protect, getUserById);
router.post('/avatar', protect, upload.single('avatar'), updateAvatar);

module.exports = router;
