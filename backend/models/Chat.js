const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map(),
  },
}, {
  timestamps: true,
});

// Indexes for performance
chatSchema.index({ participants: 1 }, { unique: true });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ 'participants': 1, 'lastMessageAt': -1 });

module.exports = mongoose.model('Chat', chatSchema);
