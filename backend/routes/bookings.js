const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.post('/', authenticate, async (req, res, next) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { slot_id, notes } = req.body;

    const slotResult = await client.query(
      'SELECT * FROM slots WHERE id = $1 FOR UPDATE',
      [slot_id]
    );

    if (slotResult.rows.length === 0) {
      throw new Error('Slot not found');
    }

    const slot = slotResult.rows[0];

    if (slot.status !== 'available') {
      throw new Error('Slot is not available');
    }

    if (slot.booked_count >= slot.capacity) {
      throw new Error('Slot is full');
    }

    const existingBooking = await client.query(
      'SELECT * FROM bookings WHERE user_id = $1 AND slot_id = $2 AND status NOT IN (\'cancelled\')',
      [req.user.id, slot_id]
    );

    if (existingBooking.rows.length > 0) {
      throw new Error('You already have a booking for this slot');
    }

    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, slot_id, trainer_id, status, notes)
       VALUES ($1, $2, $3, 'confirmed', $4)
       RETURNING *`,
      [req.user.id, slot_id, slot.trainer_id, notes]
    );

    await client.query(
      'UPDATE slots SET booked_count = booked_count + 1 WHERE id = $1',
      [slot_id]
    );

    await client.query(
      `UPDATE slots SET status = 'full'
       WHERE id = $1 AND booked_count >= capacity`,
      [slot_id]
    );

    await client.query('COMMIT');
    res.status(201).json(bookingResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.get('/my-bookings', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT b.*,
             s.start_time, s.end_time,
             t.id as trainer_id,
             p.full_name as trainer_name, p.avatar_url as trainer_avatar
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      JOIN trainers t ON b.trainer_id = t.id
      JOIN profiles p ON t.user_id = p.id
      WHERE b.user_id = $1
      ORDER BY s.start_time DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/cancel', authenticate, async (req, res, next) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { cancellation_reason } = req.body;

    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = bookingResult.rows[0];

    if (booking.status === 'cancelled') {
      throw new Error('Booking is already cancelled');
    }

    await client.query(
      `UPDATE bookings
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by = $1,
           cancellation_reason = $2
       WHERE id = $3`,
      [req.user.id, cancellation_reason, req.params.id]
    );

    await client.query(
      'UPDATE slots SET booked_count = booked_count - 1 WHERE id = $1',
      [booking.slot_id]
    );

    await client.query(
      `UPDATE slots SET status = 'available'
       WHERE id = $1 AND status = 'full'`,
      [booking.slot_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
