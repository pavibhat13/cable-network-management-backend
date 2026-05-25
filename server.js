require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const jointboxesRoutes = require('./routes/jointboxes');
const chainRoutes = require('./routes/chain');
const edfaRoutes = require('./routes/edfa');
const statsRoutes = require('./routes/stats');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5003;

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5174',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting: 500 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Body parsing
app.use(express.json());

// MongoDB connection with retry logic
const connectWithRetry = (retries = 5, delay = 3000) => {
  mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cable-network')
    .then(() => {
      console.log('[DB] MongoDB connected successfully to:', process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cable-network');
    })
    .catch((err) => {
      console.error(`[DB] MongoDB connection failed (${retries} retries left):`, err.message);
      if (retries > 0) {
        console.log(`[DB] Retrying in ${delay / 1000}s...`);
        setTimeout(() => connectWithRetry(retries - 1, delay), delay);
      } else {
        console.error('[DB] All connection retries exhausted. Exiting.');
        process.exit(1);
      }
    });
};

connectWithRetry();

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/jointboxes', jointboxesRoutes);
app.use('/api/chain', chainRoutes);
app.use('/api/edfa', edfaRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  res.json({
    status: 'ok',
    db: states[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`[SERVER] Cable Network Management API running on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
