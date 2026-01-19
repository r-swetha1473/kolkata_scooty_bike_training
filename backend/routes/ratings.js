const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Ensure ratings table exists
async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      rating_value INTEGER NOT NULL CHECK (rating_value >= 1 AND rating_value <= 5),
      comments TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(booking_id)
    );
  `);
}

// Submit a rating for a completed booking
router.post('/', authenticate, async (req, res, next) => {
  const client = await db.getClient();
  try {
    await ensureTables();
    await client.query('BEGIN');

    const { booking_id, rating_value, comments } = req.body;
    if (!booking_id || !rating_value) {
      const error = new Error('booking_id and rating_value are required');
      error.status = 400;
      error.errorCode = 'MISSING_REQUIRED_FIELDS';
      return next(error);
    }

    // Validate booking belongs to user and is completed
    const bookingRes = await client.query(
      `SELECT b.*, s.trainer_id FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [booking_id, req.user.id]
    );
    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Booking not found');
      error.status = 404;
      error.errorCode = 'BOOKING_NOT_FOUND';
      return next(error);
    }
    const booking = bookingRes.rows[0];
    if (booking.status !== 'completed') {
      await client.query('ROLLBACK');
      const error = new Error('Only completed bookings can be rated');
      error.status = 400;
      error.errorCode = 'INVALID_BOOKING_STATUS';
      return next(error);
    }

    // Insert rating (one per booking)
    const insertRes = await client.query(
      `INSERT INTO ratings (trainer_id, user_id, booking_id, rating_value, comments)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (booking_id) DO UPDATE SET rating_value = EXCLUDED.rating_value, comments = EXCLUDED.comments
       RETURNING *`,
      [booking.trainer_id, req.user.id, booking_id, rating_value, comments || null]
    );

    // Recompute average rating for the trainer
    const avgRes = await client.query(
      `SELECT AVG(rating_value)::numeric(3,2) AS avg_rating FROM ratings WHERE trainer_id = $1`,
      [booking.trainer_id]
    );
    const avg = avgRes.rows[0].avg_rating || 0;

    await client.query(
      `UPDATE trainers SET rating = $1, updated_at = NOW() WHERE id = $2`,
      [avg, booking.trainer_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ rating: insertRes.rows[0], trainer_rating: avg });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Get ratings for a trainer (optional helper)
router.get('/trainer/:trainerId', async (req, res, next) => {
  try {
    await ensureTables();
    const result = await db.query(
      `SELECT * FROM ratings WHERE trainer_id = $1 ORDER BY created_at DESC`,
      [req.params.trainerId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;


