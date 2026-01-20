const User = require('../models/User');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

exports.getAllUsers = async (req, res) => {
  try {
    // Try cache first
    const cacheKey = 'users:all';
    const cached = await cache.get(cacheKey);
    if (cached) {
      // Filter out current user from cached results
      const users = cached.filter(u => u._id.toString() !== req.user.id);
      return res.json({
        success: true,
        users,
      });
    }

    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('username email avatar isOnline lastSeen')
      .sort({ username: 1 })
      .lean(); // Use lean() for better performance

    // Cache for 2 minutes
    await cache.set(cacheKey, users, 120);

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    logger.error('Get all users error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    // Try cache first
    const cacheKey = `user:${req.params.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        user: cached,
      });
    }

    const user = await User.findById(req.params.id)
      .select('username email avatar isOnline lastSeen createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Cache for 5 minutes
    await cache.set(cacheKey, user, 300);

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error('Get user by ID error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.file) {
      user.avatar = `/uploads/images/${req.file.filename}`;
      await user.save();

      // Clear cache
      await cache.del(`user:${user._id}`);
      await cache.del('users:all');
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    logger.error('Update avatar error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};
