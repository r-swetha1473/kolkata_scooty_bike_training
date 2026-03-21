const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const config = require('../app.config');
const { normalizeIndianMobileDigits } = require('../utils/phoneNormalize');
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
    const { full_name, phone: rawPhone, email } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      params.push(full_name);
    }
    if (rawPhone !== undefined) {
      const normalizedPhone = normalizeIndianMobileDigits(rawPhone);
      if (!config.booking.phoneNumberPattern.test(normalizedPhone)) {
        const err = new Error(config.booking.phoneNumberErrorMessage);
        err.status = 400;
        err.errorCode = 'INVALID_PHONE';
        return next(err);
      }
      updates.push(`phone = $${paramIndex++}`);
      params.push(normalizedPhone);
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
  } catch (err) {
    if (err.code === '23505') {
      const dup = new Error('This mobile number is already registered to another account.');
      dup.status = 409;
      dup.errorCode = 'DUPLICATE_PHONE';
      return next(dup);
    }
    next(err);
  }
});

module.exports = router;
