const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
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

const app = express();
const events = require('./events');

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));
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
app.use('/api/ratings', strictLimiter, ratingsRoutes);

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

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
