const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// TODO: Cloudinary + multer upload configuration goes here.
// When Cloudinary is configured:
//   1. npm install cloudinary multer multer-storage-cloudinary
//   2. Configure cloudinary with CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
//   3. Set up multer with CloudinaryStorage for photos (image/*) and voice notes (audio/*)
//   4. Replace the stub handlers below with actual upload middleware and Cloudinary URL response

/**
 * POST /api/upload/photo
 * Stub endpoint for photo upload via Cloudinary (not yet configured).
 */
router.post('/photo', authenticateToken, (req, res) => {
  console.log('[UPLOAD] Photo upload requested — Cloudinary not yet configured.');
  res.status(501).json({ error: 'Cloudinary not configured' });
});

/**
 * POST /api/upload/voice
 * Stub endpoint for voice note upload via Cloudinary (not yet configured).
 */
router.post('/voice', authenticateToken, (req, res) => {
  console.log('[UPLOAD] Voice note upload requested — Cloudinary not yet configured.');
  res.status(501).json({ error: 'Cloudinary not configured' });
});

module.exports = router;
