const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateLogin } = require('../validators');
const auditService = require('../services/audit.service');
const permissionsService = require('../services/permissions.service');
const { setAuthCookie, clearAuthCookie, getClientIp } = require('../utils/authCookie');
const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Try again later.'
});

const ADMIN_ROLES = ['admin', 'superadmin', 'subadmin'];

function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function buildAuthUserResponse(user) {
  const { password_hash, ...userWithoutPassword } = user;
  const payload = {
    ...userWithoutPassword,
    must_change_password: user.must_change_password === true
  };

  if (user.role === 'subadmin') {
    payload.permissions = await permissionsService.getPermissionsList(user.id);
  }

  return payload;
}

// Admin email/password login
router.post('/login', loginLimiter, validateLogin, async (req, res, next) => {
  const ip = getClientIp(req);

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = new Error('Email and password are required');
      error.status = 400;
      error.errorCode = 'MISSING_CREDENTIALS';
      return next(error);
    }

    if (!process.env.JWT_SECRET) {
      const error = new Error('Server configuration error. JWT_SECRET is missing.');
      error.status = 500;
      error.errorCode = 'SERVER_CONFIG_ERROR';
      return next(error);
    }

    const result = await db.query('SELECT * FROM profiles WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      await auditService.logAuthEvent(null, 'LOGIN_FAILED', { email, reason: 'user_not_found' }, ip);
      const error = new Error('Invalid email or password');
      error.status = 401;
      error.errorCode = 'INVALID_CREDENTIALS';
      return next(error);
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      await auditService.logAuthEvent(user.id, 'LOGIN_FAILED', { email, reason: 'no_password' }, ip);
      const error = new Error('Invalid email or password');
      error.status = 401;
      error.errorCode = 'INVALID_CREDENTIALS';
      return next(error);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await auditService.logAuthEvent(user.id, 'LOGIN_FAILED', { email, reason: 'invalid_password' }, ip);
      const error = new Error('Invalid email or password');
      error.status = 401;
      error.errorCode = 'INVALID_CREDENTIALS';
      return next(error);
    }

    if (!ADMIN_ROLES.includes(user.role)) {
      await auditService.logAuthEvent(user.id, 'LOGIN_FAILED', { email, reason: 'insufficient_role', role: user.role }, ip);
      const error = new Error('Access denied. Admin credentials required.');
      error.status = 403;
      error.errorCode = 'ACCESS_DENIED';
      return next(error);
    }

    if (user.admin_is_active === false) {
      await auditService.logAuthEvent(user.id, 'LOGIN_FAILED', { email, reason: 'account_inactive' }, ip);
      const error = new Error('Account is deactivated. Contact super admin.');
      error.status = 403;
      error.errorCode = 'ADMIN_ACCOUNT_INACTIVE';
      return next(error);
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    const userResponse = await buildAuthUserResponse(user);
    await auditService.logAuthEvent(user.id, 'LOGIN_SUCCESS', { email, role: user.role }, ip);

    res.json({ token, user: userResponse });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
});

const isGoogleOAuthEnabled = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

router.get('/google', (req, res, next) => {
  if (!isGoogleOAuthEnabled()) {
    const error = new Error('Google OAuth is not configured on this server');
    error.status = 503;
    error.errorCode = 'OAUTH_NOT_CONFIGURED';
    return next(error);
  }
  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
  (req, res, next) => {
    if (!isGoogleOAuthEnabled()) {
      const error = new Error('Google OAuth is not configured on this server');
      error.status = 503;
      error.errorCode = 'OAUTH_NOT_CONFIGURED';
      return next(error);
    }
    return next();
  },
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const frontendUrl = (process.env.FRONTEND_URL || 'https://kolkata-scooty-bike-training.vercel.app').replace(/\/$/, '');

      if (!req.user || !req.user.id) {
        return res.redirect(`${frontendUrl}/booking?error=auth_failed`);
      }

      const userResult = await db.query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
      if (userResult.rows.length === 0) {
        return res.redirect(`${frontendUrl}/booking?error=user_not_found`);
      }

      const user = userResult.rows[0];
      const token = signToken(user);
      setAuthCookie(res, token);

      await auditService.logAuthEvent(user.id, 'LOGIN_SUCCESS', { method: 'google_oauth', email: user.email }, getClientIp(req));

      res.redirect(`${frontendUrl}/profile?oauth=success`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      const frontendUrl = (process.env.FRONTEND_URL || 'https://kolkata-scooty-bike-training.vercel.app').replace(/\/$/, '');
      res.redirect(`${frontendUrl}/booking?error=auth_error`);
    }
  }
);

router.post('/logout', authenticate, async (req, res) => {
  const ip = getClientIp(req);
  await auditService.logAuthEvent(req.user.id, 'LOGOUT', { email: req.user.email }, ip);
  clearAuthCookie(res);
  req.logout(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const userResponse = await buildAuthUserResponse(req.user);
    res.json(userResponse);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
