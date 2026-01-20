const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    default: '',
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'audio', 'video', 'file', 'call-video-ended', 'call-audio-ended', 'call-missed'],
    default: 'text',
  },
  fileUrl: {
    type: String,
    default: '',
  },
  fileName: {
    type: String,
    default: '',
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  mimeType: {
    type: String,
    default: '',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  isDisappearing: {
    type: Boolean,
    default: false,
  },
  disappearAfterRead: {
    type: Boolean,
    default: false, // If true, delete after being read. If false, delete after time
  },
  disappearAt: {
    type: Date, // When to delete if disappearAfterRead is false
  },
  deletedAt: {
    type: Date, // When message was actually deleted
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ isDisappearing: 1, disappearAt: 1 });
messageSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Message', messageSchema);
