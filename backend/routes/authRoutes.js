const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const validators = require('../utils/validators');

router.post('/register', authLimiter, validate(validators.register), register);
router.post('/login', authLimiter, validate(validators.login), login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
