/**
 * Centralized rate limiters for Render/production.
 * Requires app.set('trust proxy', 1) so req.ip reflects the real client IP.
 */
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const WINDOW_MS = 15 * 60 * 1000;
function peekJwtUserId(req) {
  try {
    const raw = req.headers.authorization && String(req.headers.authorization).trim();
    if (!raw || !/^Bearer\s+/i.test(raw)) return null;
    const token = /^Bearer\s+(\S+)$/i.exec(raw)?.[1];
    if (!token || !process.env.JWT_SECRET) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createLimiter({ name, max, keyGenerator, skip }) {
  const limiter = rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => clientIp(req)),
    skip: skip || (() => false),
    handler: (req, res) => {
      console.warn('[RateLimit] exceeded', {
        limiter: name,
        route: req.originalUrl,
        method: req.method,
        ip: clientIp(req),
        user_id: peekJwtUserId(req),
        remaining: 0,
        limit: max
      });
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
        errorCode: 'RATE_LIMITED'
      });
    }
  });

  const logUsage = (req, res, next) => {
    const shouldLog =
      process.env.LOG_RATE_LIMIT_DEBUG === '1' ||
      req.originalUrl?.startsWith('/api/admin');
    if (!shouldLog) return next();

    res.on('finish', () => {
      const remaining = res.getHeader('RateLimit-Remaining');
      const limit = res.getHeader('RateLimit-Limit');
      if (remaining === undefined) return;
      const remainingNum = Number(remaining);
      if (Number.isFinite(remainingNum) && remainingNum <= 25) {
        console.log('[RateLimit] usage', {
          limiter: name,
          route: req.originalUrl,
          method: req.method,
          ip: clientIp(req),
          user_id: peekJwtUserId(req),
          remaining: remainingNum,
          limit: limit != null ? Number(limit) : max
        });
      }
    });
    next();
  };

  return [logUsage, limiter];
}

/** Public write / non-polling protected APIs — 100 / 15 min per IP */
const strictLimiter = createLimiter({
  name: 'strict',
  max: 100
});

/** High-volume public GET polling (slots, trainers) — unchanged for booking UX */
const pollingLimiter = createLimiter({
  name: 'polling',
  max: 5000
});

/** Admin panel APIs — 1000 / 15 min per staff user (JWT) or IP */
const adminLimiter = createLimiter({
  name: 'admin',
  max: 1000,
  keyGenerator: (req) => {
    const userId = peekJwtUserId(req);
    return userId ? `admin:${userId}` : clientIp(req);
  }
});

/** Auth login — 20 / 15 min per IP */
const authLoginLimiter = createLimiter({
  name: 'auth-login',
  max: 20
});

module.exports = {
  strictLimiter,
  pollingLimiter,
  adminLimiter,
  authLoginLimiter
};
