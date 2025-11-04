const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const emailService = require('../services/email.service');
const router = express.Router();

router.post('/', authenticate, async (req, res, next) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { slot_id, trainer_id, vehicle_id, notes } = req.body;

    if (!slot_id) {
      throw new Error('slot_id is required');
    }

    if (!trainer_id) {
      throw new Error('trainer_id is required');
    }

    if (!vehicle_id) {
      throw new Error('vehicle_id is required');
    }

    // Verify vehicle exists
    const vehicleCheck = await client.query(
      'SELECT id, name, type FROM vehicles WHERE id = $1 AND is_active = true',
      [vehicle_id]
    );

    if (vehicleCheck.rows.length === 0) {
      throw new Error('Invalid vehicle selected');
    }

    const slotResult = await client.query(
      `SELECT s.*, t.is_active as trainer_is_active 
       FROM slots s 
       LEFT JOIN trainers t ON s.trainer_id = t.id 
       WHERE s.id = $1 FOR UPDATE`,
      [slot_id]
    );

    if (slotResult.rows.length === 0) {
      throw new Error('Slot not found');
    }

    const slot = slotResult.rows[0];

    // Verify trainer matches slot or allow reassignment
    if (slot.trainer_id && slot.trainer_id !== trainer_id) {
      // Allow booking with different trainer if slot is available
      const trainerCheck = await client.query(
        'SELECT id, is_active FROM trainers WHERE id = $1',
        [trainer_id]
      );
      if (trainerCheck.rows.length === 0 || !trainerCheck.rows[0].is_active) {
        throw new Error('Selected trainer is not available');
      }
    } else if (!slot.trainer_id) {
      // Assign trainer to slot if not assigned
      await client.query(
        'UPDATE slots SET trainer_id = $1 WHERE id = $2',
        [trainer_id, slot_id]
      );
    }

    if (slot.status === 'disabled' || slot.status === 'cancelled') {
      throw new Error('Slot is not available');
    }

    if (slot.status !== 'available' && slot.status !== 'full') {
      throw new Error('Slot is not available for booking');
    }

    if (slot.booked_count >= slot.capacity) {
      throw new Error('Slot is already fully booked');
    }

    const existingBooking = await client.query(
      'SELECT * FROM bookings WHERE user_id = $1 AND slot_id = $2 AND status NOT IN (\'cancelled\')',
      [req.user.id, slot_id]
    );

    if (existingBooking.rows.length > 0) {
      throw new Error('You already have a booking for this slot');
    }

    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, slot_id, trainer_id, vehicle_id, status, notes)
       VALUES ($1, $2, $3, $4, 'confirmed', $5)
       RETURNING *`,
      [req.user.id, slot_id, trainer_id, vehicle_id, notes]
    );

    // Update slot booked_count
    const slotUpdateResult = await client.query(
      'UPDATE slots SET booked_count = booked_count + 1 WHERE id = $1 RETURNING booked_count, capacity',
      [slot_id]
    );

    const updatedSlot = slotUpdateResult.rows[0];
    
    // Update slot status based on capacity
    if (updatedSlot.booked_count >= updatedSlot.capacity) {
      await client.query(
        `UPDATE slots SET status = 'full' WHERE id = $1`,
        [slot_id]
      );
    } else if (updatedSlot.booked_count === 1) {
      // First booking - mark as booked (but not full)
      await client.query(
        `UPDATE slots SET status = 'available' WHERE id = $1`,
        [slot_id]
      );
    }

    await client.query('COMMIT');

    // Send email notification (non-blocking)
    try {
      const [userResult, slotResult, trainerResult, vehicleResult] = await Promise.all([
        db.query('SELECT * FROM profiles WHERE id = $1', [req.user.id]),
        db.query('SELECT * FROM slots WHERE id = $1', [slot_id]),
        db.query(`
          SELECT t.*, p.full_name, p.avatar_url 
          FROM trainers t 
          JOIN profiles p ON t.user_id = p.id 
          WHERE t.id = $1
        `, [trainer_id]),
        db.query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id])
      ]);

      if (userResult.rows[0] && slotResult.rows[0] && trainerResult.rows[0] && vehicleResult.rows[0]) {
        emailService.sendBookingConfirmation(
          bookingResult.rows[0],
          userResult.rows[0],
          slotResult.rows[0],
          { full_name: trainerResult.rows[0].full_name },
          vehicleResult.rows[0]
        ).catch(err => console.error('Email notification failed:', err));
      }
    } catch (emailError) {
      console.error('Failed to send booking email:', emailError);
      // Don't fail the request if email fails
    }

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
             s.start_time, s.end_time, s.slot_date,
             t.id as trainer_id,
             p.full_name as trainer_name, p.avatar_url as trainer_avatar,
             v.name as vehicle_name, v.type as vehicle_type
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      JOIN trainers t ON b.trainer_id = t.id
      JOIN profiles p ON t.user_id = p.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
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

    // Update slot status to available if no more bookings
    const slotCheck = await client.query(
      `SELECT booked_count FROM slots WHERE id = $1`,
      [booking.slot_id]
    );
    
    if (slotCheck.rows.length > 0 && slotCheck.rows[0].booked_count === 0) {
      await client.query(
        `UPDATE slots SET status = 'available' WHERE id = $1`,
        [booking.slot_id]
      );
    }

    await client.query('COMMIT');

    // Send cancellation email (non-blocking)
    try {
      const [userResult, slotResult, trainerResult, vehicleResult] = await Promise.all([
        db.query('SELECT * FROM profiles WHERE id = $1', [req.user.id]),
        db.query('SELECT * FROM slots WHERE id = $1', [booking.slot_id]),
        db.query(`
          SELECT t.*, p.full_name, p.avatar_url 
          FROM trainers t 
          JOIN profiles p ON t.user_id = p.id 
          WHERE t.id = $1
        `, [booking.trainer_id]),
        booking.vehicle_id ? db.query('SELECT * FROM vehicles WHERE id = $1', [booking.vehicle_id]) : Promise.resolve({ rows: [{ name: 'N/A', type: 'N/A' }] })
      ]);

      if (userResult.rows[0] && slotResult.rows[0] && trainerResult.rows[0]) {
        emailService.sendBookingCancellation(
          booking,
          userResult.rows[0],
          slotResult.rows[0],
          { full_name: trainerResult.rows[0].full_name },
          vehicleResult.rows[0] || { name: 'N/A', type: 'N/A' }
        ).catch(err => console.error('Email notification failed:', err));
      }
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
