const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');
const trainerRoutes = require('./routes/trainers');
const slotRoutes = require('./routes/slots');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const ratingsRoutes = require('./routes/ratings');
const settingsRoutes = require('./routes/settings');
const vehiclesRoutes = require('./routes/vehicles');
const recognitionRoutes = require('./routes/recognition');
const adminManagementRoutes = require('./routes/adminManagement');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const events = require('./events');

app.use(helmet());

// CORS configuration: allow main frontend, preview frontend and local Angular dev
// FRONTEND_URL          -> main production frontend
// FRONTEND_URL_PREVIEW  -> Vercel preview / staging frontend (optional)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_PREVIEW,
  'http://localhost:4200'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser/SSR requests with no origin
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

require('./config/passport');

// Create rate limiters
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

// Very lenient limiter for public GET endpoints (for polling)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000, // Allow 5000 requests per 15 minutes for polling
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.'
});

// Register routes - apply limiters as middleware
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

// Public GET endpoints with lenient limiter
app.use('/api/trainers', (req, res, next) => {
  if (req.method === 'GET') {
    return publicLimiter(req, res, next);
  }
  return strictLimiter(req, res, next);
});
app.use('/api/trainers', trainerRoutes);

app.use('/api/slots', (req, res, next) => {
  if (req.method === 'GET') {
    return publicLimiter(req, res, next);
  }
  return strictLimiter(req, res, next);
});
app.use('/api/slots', slotRoutes);

app.use('/api/vehicles', (req, res, next) => {
  if (req.method === 'GET') {
    return publicLimiter(req, res, next);
  }
  return strictLimiter(req, res, next);
});
app.use('/api/vehicles', vehiclesRoutes);

app.use('/api/settings', (req, res, next) => {
  if (req.method === 'GET') {
    return publicLimiter(req, res, next);
  }
  return strictLimiter(req, res, next);
});
app.use('/api/settings', settingsRoutes);

// Protected routes with strict limiter
app.use('/api/bookings', strictLimiter, bookingRoutes);
app.use('/api/admin', strictLimiter, adminRoutes);
app.use('/api/admin-management', strictLimiter, adminManagementRoutes);
app.use('/api/ratings', strictLimiter, ratingsRoutes);
app.use('/api/recognition', strictLimiter, recognitionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Server-Sent Events endpoint for real-time updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // Send initial comment to establish stream
  res.write(': connected\n\n');
  events.addClient(res);

  const keepAlive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch (_) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    events.removeClient(res);
    try { res.end(); } catch (_) {}
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to 0.0.0.0 for Docker compatibility

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
    
    // Close database connections
    const { pool } = require('./db');
    pool.end(() => {
      console.log('Database connections closed.');
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
