const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const path = require('path');

router.post('/file', protect, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileType = req.file.mimetype.startsWith('image/') ? 'images' :
                     req.file.mimetype.startsWith('audio/') ? 'audio' :
                     req.file.mimetype.startsWith('video/') ? 'videos' : 'files';

    res.json({
      success: true,
      file: {
        url: `/uploads/${fileType}/${req.file.filename}`,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        messageType: req.file.mimetype.startsWith('image/') ? 'image' :
                     req.file.mimetype.startsWith('audio/') ? 'audio' :
                     req.file.mimetype.startsWith('video/') ? 'video' : 'file',
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
