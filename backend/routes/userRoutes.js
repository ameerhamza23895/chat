const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateAvatar,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const validators = require('../utils/validators');

router.get('/all', protect, getAllUsers);
router.get('/:id', protect, validate(validators.getUserById), getUserById);
router.post('/avatar', protect, uploadLimiter, upload.single('avatar'), updateAvatar);

module.exports = router;
