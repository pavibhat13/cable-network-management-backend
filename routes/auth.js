const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticates the single admin user via direct string comparison
 * against ADMIN_USERNAME and ADMIN_PASSWORD environment variables.
 * Returns a signed JWT on success.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Simple string comparison for single-user app (plaintext env credentials)
  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const payload = { username };
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET || 'cable-network-secret-change-in-production',
    { expiresIn: '7d' }
  );

  return res.json({ token, username });
});

module.exports = router;
