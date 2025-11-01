const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.use(authorize('admin', 'superadmin'));

router.get('/bookings', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT b.*,
             s.start_time, s.end_time,
             u.full_name as user_name, u.email as user_email,
             t.id as trainer_id,
             p.full_name as trainer_name
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      JOIN profiles u ON b.user_id = u.id
      JOIN trainers t ON b.trainer_id = t.id
      JOIN profiles p ON t.user_id = p.id
      ORDER BY s.start_time DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, email, full_name, phone, role, created_at
      FROM profiles
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = {};

    const totalUsers = await db.query('SELECT COUNT(*) FROM profiles');
    stats.totalUsers = parseInt(totalUsers.rows[0].count);

    const totalBookings = await db.query('SELECT COUNT(*) FROM bookings');
    stats.totalBookings = parseInt(totalBookings.rows[0].count);

    const activeTrainers = await db.query('SELECT COUNT(*) FROM trainers WHERE is_active = true');
    stats.activeTrainers = parseInt(activeTrainers.rows[0].count);

    const upcomingBookings = await db.query(`
      SELECT COUNT(*) FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      WHERE s.start_time > NOW() AND b.status = 'confirmed'
    `);
    stats.upcomingBookings = parseInt(upcomingBookings.rows[0].count);

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
