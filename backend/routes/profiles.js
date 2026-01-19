const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json(req.user);
  } catch (error) {
    next(error);
  }
});

router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { full_name, phone, email } = req.body;

    // Phone is required for customers
    if (req.user.role === 'customer' && !phone) {
      const error = new Error('Phone number is required for customers');
      error.status = 400;
      error.errorCode = 'PHONE_REQUIRED';
      return next(error);
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      params.push(full_name);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }

    if (updates.length === 0) {
      const error = new Error('No fields to update');
      error.status = 400;
      error.errorCode = 'NO_FIELDS_TO_UPDATE';
      return next(error);
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.user.id);

    const result = await db.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      const error = new Error('Profile not found');
      error.status = 404;
      error.errorCode = 'PROFILE_NOT_FOUND';
      return next(error);
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      const error = new Error('Phone number already exists');
      error.status = 409;
      error.errorCode = 'DUPLICATE_PHONE';
      return next(error);
    }
    next(error);
  }
});

module.exports = router;
