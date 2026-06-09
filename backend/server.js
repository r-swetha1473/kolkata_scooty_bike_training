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
const cron = require('node-cron');
const { runInactivityBlockCheck } = require('./services/inactivity.service');
const { runNightlyAutoGeneration, ensureSlotsOnStartup } = require('./services/slotGeneration.service');
const { runOverdueBookingDetection } = require('./services/overdueDetection.service');

const app = express();
const events = require('./events');

app.use(helmet());

// CORS configuration: allow main frontend, preview frontend and local Angular dev
// FRONTEND_URL          -> main production frontend
// FRONTEND_URL_PREVIEW  -> Vercel preview / staging frontend (optional)
//
// Note: Normalize URLs to avoid mismatches due to trailing slashes.
const normalizeOrigin = (url) => {
  if (!url) return url;
  try {
    // Some environments may pass full URLs, others just origin strings.
    // We always strip exactly one trailing slash, if present.
    return url.replace(/\/$/, '');
  } catch {
    return url;
  }
};

const allowedOrigins = [
  normalizeOrigin(process.env.FRONTEND_URL),
  normalizeOrigin(process.env.FRONTEND_URL_PREVIEW),
  'http://localhost:4200'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser/SSR requests with no origin
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    // Exact match against allowed origins
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Optionally allow any Vercel deployment of this app
    if (normalizedOrigin.endsWith('kolkata-scooty-bike-training.vercel.app')) {
      return callback(null, true);
    }

    console.warn('Blocked CORS origin:', origin);
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

// Daily inactivity check (customers with no booking for N days → inactive_blocked)
if (process.env.DISABLE_INACTIVITY_CRON !== '1') {
  const cronExpr = process.env.INACTIVITY_CRON || '0 2 * * *';
  cron.schedule(cronExpr, () => {
    runInactivityBlockCheck().catch((err) => {
      console.error('[Inactivity cron]', err.message);
    });
  });
}

/** Auto-generate training slots for 7 days starting today (server date) at cron time (default midnight Asia/Kolkata) */
if (process.env.DISABLE_AUTO_SLOT_CRON !== '1') {
  const autoSlotCron = process.env.AUTO_SLOT_CRON || '0 0 * * *';
  const autoSlotTz = process.env.AUTO_SLOT_CRON_TZ || 'Asia/Kolkata';
  cron.schedule(
    autoSlotCron,
    () => {
      runNightlyAutoGeneration().catch((err) => {
        console.error('[Auto slot cron]', err.message);
      });
    },
    { timezone: autoSlotTz }
  );
}

if (process.env.DISABLE_OVERDUE_BOOKING_CRON !== '1') {
  const overdueCron = process.env.OVERDUE_BOOKING_CRON || '*/30 * * * *';
  cron.schedule(overdueCron, () => {
    runOverdueBookingDetection().catch((err) => {
      console.error('[Overdue booking cron]', err.message);
    });
  });
}

if (process.env.DISABLE_AUTO_SLOT_STARTUP !== '1') {
  const startupDays = Number(process.env.AUTO_SLOT_STARTUP_DAYS || '7');
  ensureSlotsOnStartup(Number.isFinite(startupDays) && startupDays > 0 ? startupDays : 7).catch((err) => {
    console.error('[Auto slot startup]', err.message);
  });
}

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
