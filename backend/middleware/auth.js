const jwt = require('jsonwebtoken');
const db = require('../db');

function logAuthMeDebug(req, fields) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  if (req.originalUrl !== '/api/auth/me' && !req.originalUrl?.endsWith('/auth/me')) {
    return;
  }
  const cookieHeader = req.headers.cookie || '';
  console.log('[Auth Debug] /auth/me request', {
    ...fields,
    host: req.get('host'),
    origin: req.headers.origin || null,
    sessionId: req.sessionID || null,
    hasCookieHeader: cookieHeader.length > 0,
    hasAuthTokenCookie: cookieHeader.includes('auth_token='),
    hasAuthorizationHeader: !!(req.headers.authorization && String(req.headers.authorization).trim())
  });
}

const authenticate = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      const err = new Error('Server configuration error');
      err.status = 500;
      err.errorCode = 'SERVER_CONFIG_ERROR';
      return next(err);
    }

    let token = null;
    let tokenSource = null;

    // Prefer explicit Authorization: Bearer <token> when present (SPA / mobile clients),
    // then fall back to httpOnly cookie (Google OAuth redirect flow).
    const rawAuth = req.headers.authorization && String(req.headers.authorization).trim();
    if (rawAuth) {
      if (/^Bearer\b/i.test(rawAuth)) {
        const match = /^Bearer\s+(\S+)$/i.exec(rawAuth);
        if (!match || !match[1]) {
          const error = new Error('Authorization header must be: Bearer <token>');
          error.status = 401;
          error.errorCode = 'MALFORMED_AUTH_HEADER';
          return next(error);
        }
        token = match[1];
        tokenSource = 'authorization_header';
      }
      // Other schemes (e.g. accidental "Basic …") are ignored so cookie auth still works
    }

    if (!token && req.cookies?.auth_token) {
      token = req.cookies.auth_token;
      tokenSource = 'cookie';
    }

    if (!token) {
      logAuthMeDebug(req, {
        failureReason: 'NO_TOKEN',
        reqUser: req.user?.id || null
      });
      const error = new Error('Authentication required. No token provided. Sign in again or send Authorization: Bearer <token>.');
      error.status = 401;
      error.errorCode = 'NO_TOKEN';
      return next(error);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      'SELECT * FROM profiles WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      logAuthMeDebug(req, {
        failureReason: 'USER_NOT_FOUND',
        tokenSource,
        decodedUserId: decoded.userId
      });
      const error = new Error('User not found');
      error.status = 401;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    req.user = result.rows[0];
    req.auth = { tokenSource };
    logAuthMeDebug(req, {
      success: true,
      tokenSource,
      reqUser: req.user.id,
      email: req.user.email
    });
    next();
  } catch (error) {
    logAuthMeDebug(req, {
      failureReason: error.errorCode || error.name || 'AUTHENTICATION_ERROR',
      errorMessage: error.message
    });
    // Handle JWT verification errors
    if (error.name === 'JsonWebTokenError') {
      error.status = 401;
      error.errorCode = 'INVALID_TOKEN';
      error.message = 'Invalid token. Sign in again.';
    } else if (error.name === 'TokenExpiredError') {
      error.status = 401;
      error.errorCode = 'TOKEN_EXPIRED';
      error.message = 'Session expired. Please sign in again.';
    } else {
      error.status = 401;
      error.errorCode = 'AUTHENTICATION_ERROR';
    }
    return next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      const error = new Error('Not authenticated');
      error.status = 401;
      error.errorCode = 'NOT_AUTHENTICATED';
      return next(error);
    }

    // Check authorization based on profiles.role (existing system)
    if (!roles.includes(req.user.role)) {
      const error = new Error('Insufficient permissions');
      error.status = 403;
      error.errorCode = 'INSUFFICIENT_PERMISSIONS';
      return next(error);
    }

    next();
  };
};

/**
 * Enhanced authorize function for admin management routes
 * Checks admins table for SUPER_ADMIN or ADMIN roles
 */
const authorizeAdmin = (...adminRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      const error = new Error('Not authenticated');
      error.status = 401;
      error.errorCode = 'NOT_AUTHENTICATED';
      return next(error);
    }

    try {
      // Check admins table
      const adminResult = await db.query(
        `SELECT a.id, a.role, a.is_active, a.locked_until
         FROM admins a 
         JOIN profiles p ON a.profile_id = p.id 
         WHERE p.id = $1`,
        [req.user.id]
      );

      if (adminResult.rows.length === 0) {
        const error = new Error('Admin account not found');
        error.status = 403;
        error.errorCode = 'ADMIN_ACCOUNT_NOT_FOUND';
        return next(error);
      }

      const admin = adminResult.rows[0];

      if (!admin.is_active) {
        const error = new Error('Admin account is inactive');
        error.status = 403;
        error.errorCode = 'ADMIN_ACCOUNT_INACTIVE';
        return next(error);
      }

      // Check if account is locked (if locked_until column exists)
      if (admin.locked_until && admin.locked_until !== null && new Date(admin.locked_until) > new Date()) {
        const error = new Error('Admin account is locked');
        error.status = 403;
        error.errorCode = 'ADMIN_ACCOUNT_LOCKED';
        return next(error);
      }

      if (!adminRoles.includes(admin.role)) {
        const error = new Error('Insufficient permissions');
        error.status = 403;
        error.errorCode = 'INSUFFICIENT_PERMISSIONS';
        return next(error);
      }

      // Attach admin info to request
      req.user.adminRole = admin.role;
      req.user.adminId = adminResult.rows[0].id;
      req.user.adminLockedUntil = admin.locked_until;
      next();
    } catch (error) {
      // If admins table doesn't exist, fall back to profiles.role
      if (req.user.role === 'superadmin' && adminRoles.includes('SUPER_ADMIN')) {
        req.user.adminRole = 'SUPER_ADMIN';
        return next();
      }
      if (req.user.role === 'admin' && adminRoles.includes('ADMIN')) {
        req.user.adminRole = 'ADMIN';
        return next();
      }
      
      const authError = new Error('Insufficient permissions');
      authError.status = 403;
      authError.errorCode = 'INSUFFICIENT_PERMISSIONS';
      return next(authError);
    }
  };
};

module.exports = { authenticate, authorize, authorizeAdmin };
