const User = require('../models/User');
const jwt = require('jsonwebtoken');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

exports.register = async (req, res) => {
  try {
    logger.info('Register attempt', { email: req.body.email, username: req.body.username });
    
    const { username, email, password } = req.body;

    // Check cache first
    const cacheKey = `user:${email}:${username}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.warn('User already exists (cached)', { email, username });
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      // Cache the result
      await cache.set(cacheKey, true, 300); // 5 minutes
      logger.warn('User already exists', { email, username });
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
    });

    logger.info('User created successfully', { userId: user._id });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    logger.error('Register error', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    logger.info('Login attempt', { email: req.body.email });
    
    const { email, password } = req.body;

    // Check if user exists and get password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logger.warn('Login failed - User not found', { email });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn('Login failed - Invalid password', { email });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Clear any cached user data
    await cache.del(`user:${user._id}`);

    logger.info('Login successful', { userId: user._id });

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isOnline: user.isOnline,
      },
    });
  } catch (error) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    // Try cache first
    const cacheKey = `user:${req.user.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        user: cached,
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
    };

    // Cache user data for 5 minutes
    await cache.set(cacheKey, userData, 300);

    res.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    logger.error('Get me error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
