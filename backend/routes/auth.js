const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// Admin email/password login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ error: 'Server configuration error. JWT_SECRET is missing.' });
    }

    // Find user by email
    const result = await db.query(
      'SELECT * FROM profiles WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`Login attempt failed: User not found for email: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user has password_hash (admin/superadmin)
    if (!user.password_hash) {
      console.log(`Login attempt failed: No password_hash for user: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      console.log(`Login attempt failed: Invalid password for user: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is admin or superadmin
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      console.log(`Login attempt failed: Insufficient role for user: ${email}, role: ${user.role}`);
      return res.status(403).json({ error: 'Access denied. Admin credentials required.' });
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
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    res.redirect(`${frontendUrl}/booking?token=${token}`);
  }
);

router.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', authenticate, (req, res) => {
  // Remove password_hash from response
  const { password_hash, ...userWithoutPassword } = req.user;
  res.json(userWithoutPassword);
});

module.exports = router;
