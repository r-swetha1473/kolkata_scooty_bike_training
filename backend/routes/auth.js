const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateLogin } = require('../validators');
const router = express.Router();

// Rate limiter for login endpoint (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: 'Too many login attempts. Try again later.'
});

// Admin email/password login
router.post('/login', loginLimiter, validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = new Error('Email and password are required');
      error.status = 400;
      error.errorCode = 'MISSING_CREDENTIALS';
      return next(error);
    }

    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      const error = new Error('Server configuration error. JWT_SECRET is missing.');
      error.status = 500;
      error.errorCode = 'SERVER_CONFIG_ERROR';
      return next(error);
    }

    // Find user by email
    const result = await db.query(
      'SELECT * FROM profiles WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`Login attempt failed: User not found for email: ${email}`);
      const error = new Error('Invalid email or password');
      error.status = 401;
      error.errorCode = 'INVALID_CREDENTIALS';
      return next(error);
    }

    const user = result.rows[0];

    // Check if user has password_hash (admin/superadmin)
    if (!user.password_hash) {
      console.log(`Login attempt failed: No password_hash for user: ${email}`);
      const error = new Error('Invalid email or password');
      error.status = 401;
      error.errorCode = 'INVALID_CREDENTIALS';
      return next(error);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      console.log(`Login attempt failed: Invalid password for user: ${email}`);
      const error = new Error('Invalid email or password');
      error.status = 401;
      error.errorCode = 'INVALID_CREDENTIALS';
      return next(error);
    }

    // Check if user is admin or superadmin
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      console.log(`Login attempt failed: Insufficient role for user: ${email}, role: ${user.role}`);
      const error = new Error('Access denied. Admin credentials required.');
      error.status = 403;
      error.errorCode = 'ACCESS_DENIED';
      return next(error);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return token and user (without password_hash)
    const { password_hash, ...userWithoutPassword } = user;

    console.log(`Login successful for user: ${email}, role: ${user.role}`);
    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
});

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const frontendUrl = (process.env.FRONTEND_URL || 'https://kolkata-scooty-bike-training.vercel.app').replace(/\/$/, '');

      // Ensure user data is stored (passport should have done this, but verify)
      if (!req.user || !req.user.id) {
        return res.redirect(`${frontendUrl}/booking?error=auth_failed`);
      }

      // Fetch fresh user data from database to ensure we have latest
      console.log(`[Google OAuth Callback] Fetching user data for ID: ${req.user.id}`);
      const userResult = await db.query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
      if (userResult.rows.length === 0) {
        console.error(`[Google OAuth Callback] User not found in database: ${req.user.id}`);
        return res.redirect(`${frontendUrl}/booking?error=user_not_found`);
      }

      const user = userResult.rows[0];
      console.log(`[Google OAuth Callback] User found: ${user.email}, ID: ${user.id}, Role: ${user.role}`);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Store token in httpOnly cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Redirect to profile page without token in URL
      console.log('Redirecting to:', `${frontendUrl}/profile`);
      res.redirect(`${frontendUrl}/profile`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      const frontendUrl = (process.env.FRONTEND_URL || 'https://kolkata-scooty-bike-training.vercel.app').replace(/\/$/, '');
      res.redirect(`${frontendUrl}/booking?error=auth_error`);
    }
  }
);

router.post('/logout', (req, res) => {
  req.logout(() => {
    // Clear the auth_token cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', authenticate, (req, res) => {
  // Remove password_hash from response
  const { password_hash, ...userWithoutPassword } = req.user;
  res.json(userWithoutPassword);
});

module.exports = router;
