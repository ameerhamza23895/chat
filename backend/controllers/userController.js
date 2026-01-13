const User = require('../models/User');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('username email avatar isOnline lastSeen')
      .sort({ username: 1 });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username email avatar isOnline lastSeen createdAt');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (req.file) {
      user.avatar = `/uploads/images/${req.file.filename}`;
      await user.save();
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
    res.status(500).json({ message: error.message });
  }
};
