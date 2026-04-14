const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const {
  validateBookingStatusUpdate,
  validateTrainerCreation,
  validateTrainerUpdate,
  validateUserUpdate,
  validateUserRoleUpdate,
  validateUserCreation,
  validateSettingsUpdate
} = require('../validators');
const auditService = require('../services/audit.service');
const router = express.Router();

router.use(authenticate);
router.use(authorize('admin', 'superadmin'));

router.get('/bookings', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status).trim() : '';
    const startDate = req.query.startDate ? String(req.query.startDate).trim() : '';
    const endDate = req.query.endDate ? String(req.query.endDate).trim() : '';
    const searchRaw = req.query.search != null ? String(req.query.search).trim() : '';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (searchRaw) {
      const q = `%${searchRaw}%`;
      conditions.push(
        `(COALESCE(u.full_name, '') ILIKE $${idx} OR COALESCE(u.email, '') ILIKE $${idx} OR COALESCE(u.phone::text, '') ILIKE $${idx} OR COALESCE(p.full_name, '') ILIKE $${idx} OR b.id::text ILIKE $${idx})`
      );
      params.push(q);
      idx++;
    }

    if (status) {
      conditions.push(`b.status = $${idx++}`);
      params.push(status);
    }

    if (startDate) {
      conditions.push(
        `COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date) >= $${idx++}::date`
      );
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(
        `COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date) <= $${idx++}::date`
      );
      params.push(endDate);
    }

    const whereSql = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM bookings b
       LEFT JOIN slots s ON b.slot_id = s.id
       WHERE ${whereSql}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;

    params.push(limit, offset);
    const limIdx = idx;
    const offIdx = idx + 1;

    const result = await db.query(
      `
      SELECT b.*,
             s.start_time, s.end_time, s.slot_date,
             u.id as user_id, u.full_name as user_name, u.email as user_email,
             t.id as trainer_table_id,
             p.id as trainer_profile_id, p.full_name as trainer_name
      FROM bookings b
      LEFT JOIN slots s ON b.slot_id = s.id
      LEFT JOIN profiles u ON b.user_id = u.id
      LEFT JOIN trainers t ON b.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      WHERE ${whereSql}
      ORDER BY s.start_time DESC NULLS LAST, b.created_at DESC
      LIMIT $${limIdx} OFFSET $${offIdx}
    `,
      params
    );

    const bookings = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      slot_id: row.slot_id,
      trainer_id: row.trainer_id,
      vehicle_id: row.vehicle_id,
      status: row.status,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        full_name: row.user_name,
        email: row.user_email
      },
      trainer: {
        id: row.trainer_table_id,
        profile: {
          id: row.trainer_profile_id,
          full_name: row.trainer_name
        }
      },
      slot: {
        start_time: row.start_time,
        end_time: row.end_time,
        slot_date: row.slot_date
      },
      // Also include flat fields for backward compatibility
      user_name: row.user_name,
      user_email: row.user_email,
      trainer_name: row.trainer_name
    }));

    res.json({ bookings, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { role, search } = req.query;
    
    let query = `
      SELECT 
        p.id, 
        p.email, 
        p.full_name, 
        p.phone, 
        p.google_id,
        p.role, 
        p.created_at,
        p.total_bookings,
        p.last_booking_date,
        p.weekly_booking_count,
        p.weekly_reset_date,
        p.inactive_blocked,
        COUNT(b.id) FILTER (WHERE b.status NOT IN ('cancelled')) as active_bookings
      FROM profiles p
      LEFT JOIN bookings b ON p.id = b.user_id
    `;
    
    const params = [];
    const conditions = [];
    
    if (role) {
      params.push(role);
      conditions.push(`p.role = $${params.length}`);
    }
    
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        p.full_name ILIKE $${params.length} OR 
        p.email ILIKE $${params.length} OR 
        p.phone ILIKE $${params.length}
      )`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += `
      GROUP BY p.id, p.email, p.full_name, p.phone, p.google_id, p.role, p.created_at, 
               p.total_bookings, p.last_booking_date, p.weekly_booking_count, p.weekly_reset_date,
               p.inactive_blocked
      ORDER BY p.created_at DESC
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get customers only (with booking stats)
router.get('/customers', async (req, res, next) => {
  try {
    const { search } = req.query;
    
    let query = `
      SELECT 
        p.id, 
        p.email, 
        p.full_name, 
        p.phone, 
        p.created_at,
        p.total_bookings,
        p.last_booking_date,
        p.weekly_booking_count,
        p.weekly_reset_date,
        p.inactive_blocked,
        COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as confirmed_bookings,
        COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
        COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings
      FROM profiles p
      LEFT JOIN bookings b ON p.id = b.user_id
      WHERE p.role = 'customer'
    `;
    
    const params = [];
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        p.full_name ILIKE $${params.length} OR 
        p.email ILIKE $${params.length} OR 
        p.phone ILIKE $${params.length}
      )`;
    }
    
    query += `
      GROUP BY p.id, p.email, p.full_name, p.phone, p.created_at, 
               p.total_bookings, p.last_booking_date, p.weekly_booking_count, p.weekly_reset_date,
               p.inactive_blocked
      ORDER BY p.created_at DESC
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Export customers to CSV
router.get('/customers/export', async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;
    
    const result = await db.query(`
      SELECT 
        p.full_name as "Full Name",
        p.phone as "Phone",
        p.email as "Email",
        p.total_bookings as "Total Bookings",
        p.last_booking_date as "Last Booking Date",
        p.weekly_booking_count as "Weekly Booking Count",
        p.created_at as "Registration Date"
      FROM profiles p
      WHERE p.role = 'customer'
      ORDER BY p.created_at DESC
    `);

    if (format === 'csv') {
      if (result.rows.length === 0) {
        const error = new Error('No customers found');
        error.status = 404;
        error.errorCode = 'NO_CUSTOMERS_FOUND';
        return next(error);
      }

      // Generate CSV
      const headers = Object.keys(result.rows[0]);
      const csvRows = [
        headers.join(','),
        ...result.rows.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="customers_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvRows.join('\n'));
    } else if (format === 'json') {
      res.json(result.rows);
    } else {
      const error = new Error('Invalid format. Use "csv" or "json"');
      error.status = 400;
      error.errorCode = 'INVALID_FORMAT';
      return next(error);
    }
  } catch (error) {
    next(error);
  }
});

// Get comprehensive dashboard stats
async function getDashboardStats() {
  const stats = {};
  
  // Total bookings
  const totalBookingsResult = await db.query('SELECT COUNT(*) as count FROM bookings');
  stats.totalBookings = parseInt(totalBookingsResult.rows[0].count) || 0;

  // Active slots (available slots with trainers)
  const activeSlotsResult = await db.query(`
    SELECT COUNT(*) as count FROM slots s
    LEFT JOIN trainers t ON s.trainer_id = t.id
    WHERE s.status = 'available' 
      AND s.booked_count < s.capacity 
      AND (t.is_active = true OR s.trainer_id IS NULL)
      AND (s.slot_date >= CURRENT_DATE OR s.start_time::date >= CURRENT_DATE)
  `);
  stats.activeSlots = parseInt(activeSlotsResult.rows[0].count) || 0;

  // Total active trainers
  const activeTrainersResult = await db.query('SELECT COUNT(*) as count FROM trainers WHERE is_active = true');
  stats.totalTrainers = parseInt(activeTrainersResult.rows[0].count) || 0;
  stats.activeTrainers = stats.totalTrainers; // Alias for compatibility

  // Today's sessions (confirmed bookings for today)
  const todaySessionsResult = await db.query(`
    SELECT COUNT(*) as count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE (s.slot_date = CURRENT_DATE OR s.start_time::date = CURRENT_DATE)
      AND b.status = 'confirmed'
  `);
  stats.todaySessions = parseInt(todaySessionsResult.rows[0].count) || 0;

  // Pending bookings
  const pendingBookingsResult = await db.query(`
    SELECT COUNT(*) as count FROM bookings 
    WHERE status = 'pending'
  `);
  stats.pendingBookings = parseInt(pendingBookingsResult.rows[0].count) || 0;

  // Completed today
  const completedTodayResult = await db.query(`
    SELECT COUNT(*) as count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE (s.slot_date = CURRENT_DATE OR s.start_time::date = CURRENT_DATE)
      AND b.status = 'completed'
  `);
  stats.completedToday = parseInt(completedTodayResult.rows[0].count) || 0;

  // Additional stats
  const totalUsersResult = await db.query('SELECT COUNT(*) as count FROM profiles');
  stats.totalUsers = parseInt(totalUsersResult.rows[0].count) || 0;

  const upcomingBookingsResult = await db.query(`
    SELECT COUNT(*) as count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE s.start_time > NOW() AND b.status = 'confirmed'
  `);
  stats.upcomingBookings = parseInt(upcomingBookingsResult.rows[0].count) || 0;

  return stats;
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Alias for dashboard
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get all trainers with their profile information
router.get('/trainers', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.*,
             p.id as profile_id, p.email, p.full_name, p.phone, p.avatar_url, p.role
      FROM trainers t
      JOIN profiles p ON t.user_id = p.id
      ORDER BY t.created_at DESC
    `);

    // Format response to match frontend expectations
    const trainers = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      bio: row.bio,
      experience_years: row.experience_years,
      specialization: row.specialization,
      rating: parseFloat(row.rating) || 0,
      total_sessions: row.total_sessions,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      profile: {
        id: row.profile_id,
        email: row.email,
        full_name: row.full_name,
        phone: row.phone,
        avatar_url: row.avatar_url,
        role: row.role
      }
    }));

    res.json(trainers);
  } catch (error) {
    next(error);
  }
});

// Create trainer
router.post('/trainers', validateTrainerCreation, async (req, res, next) => {
  try {
    const { email, full_name, phone, bio, experience_years, specialization, rating } = req.body;

    if (!email || !full_name || !bio) {
      const error = new Error('Missing required fields');
      error.status = 400;
      error.errorCode = 'MISSING_REQUIRED_FIELDS';
      return next(error);
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Phone is required - generate default if not provided for trainers
      const finalPhone = phone || `TRAINER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const profileResult = await client.query(
        `INSERT INTO profiles (email, full_name, phone, role)
         VALUES ($1, $2, $3, 'trainer')
         RETURNING id`,
        [email, full_name, finalPhone]
      );

      const userId = profileResult.rows[0].id;

      const trainerResult = await client.query(
        `INSERT INTO trainers (user_id, bio, experience_years, specialization, is_active, rating)
         VALUES ($1, $2, $3, $4, true, $5)
         RETURNING *`,
        [userId, bio, experience_years || 0, specialization || [], rating != null ? rating : 0]
      );

      await client.query('COMMIT');

      res.status(201).json({
        ...trainerResult.rows[0],
        profile: profileResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === '23505') {
      const error = new Error('Email already exists');
      error.status = 409;
      error.errorCode = 'DUPLICATE_EMAIL';
      return next(error);
    }
    next(error);
  }
});

// Update trainer
router.put('/trainers/:id', validateTrainerUpdate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active, bio, experience_years, specialization, full_name, phone, rating } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(bio);
    }
    if (experience_years !== undefined) {
      updates.push(`experience_years = $${paramCount++}`);
      values.push(experience_years);
    }
    if (specialization !== undefined) {
      updates.push(`specialization = $${paramCount++}`);
      values.push(specialization);
    }
    if (rating !== undefined) {
      updates.push(`rating = $${paramCount++}`);
      values.push(rating);
    }

    if (updates.length === 0 && !full_name && !phone) {
      const error = new Error('No fields to update');
      error.status = 400;
      error.errorCode = 'NO_FIELDS_TO_UPDATE';
      return next(error);
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      if (updates.length > 0) {
        values.push(id);
        const query = `UPDATE trainers SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        await client.query(query, values);
      }

      if (full_name || phone) {
        const profileUpdates = [];
        const profileValues = [];
        let profileParamCount = 1;

        if (full_name) {
          profileUpdates.push(`full_name = $${profileParamCount++}`);
          profileValues.push(full_name);
        }
        if (phone !== undefined) {
          profileUpdates.push(`phone = $${profileParamCount++}`);
          profileValues.push(phone);
        }

        profileValues.push(id);
        const profileQuery = `UPDATE profiles SET ${profileUpdates.join(', ')} WHERE id = (SELECT user_id FROM trainers WHERE id = $${profileParamCount}) RETURNING *`;
        await client.query(profileQuery, profileValues);
      }

      const result = await client.query(
        `SELECT t.*, p.id as profile_id, p.email, p.full_name, p.phone, p.avatar_url, p.role
         FROM trainers t
         JOIN profiles p ON t.user_id = p.id
         WHERE t.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        const error = new Error('Trainer not found');
        error.status = 404;
        error.errorCode = 'TRAINER_NOT_FOUND';
        return next(error);
      }

      await client.query('COMMIT');

      const row = result.rows[0];
      res.json({
        id: row.id,
        user_id: row.user_id,
        bio: row.bio,
        experience_years: row.experience_years,
        specialization: row.specialization,
        rating: parseFloat(row.rating),
        total_sessions: row.total_sessions,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        profile: {
          id: row.profile_id,
          email: row.email,
          full_name: row.full_name,
          phone: row.phone,
          avatar_url: row.avatar_url,
          role: row.role
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Delete trainer
router.delete('/trainers/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const bookingsCheck = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE trainer_id = $1',
      [id]
    );

    if (parseInt(bookingsCheck.rows[0].count) > 0) {
      const error = new Error('Cannot delete trainer with existing bookings. Please cancel or complete all bookings for this trainer first');
      error.status = 400;
      error.errorCode = 'CANNOT_DELETE_TRAINER';
      return next(error);
    }

    const result = await db.query('DELETE FROM trainers WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      const error = new Error('Trainer not found');
      error.status = 404;
      error.errorCode = 'TRAINER_NOT_FOUND';
      return next(error);
    }

    res.json({ message: 'Trainer deleted successfully' });
  } catch (error) {
    if (error.code === '23503') {
      const error = new Error('Cannot delete trainer. This trainer has related data that must be removed first');
      error.status = 400;
      error.errorCode = 'CANNOT_DELETE_TRAINER';
      return next(error);
    }
    next(error);
  }
});

/** Legacy admin slot CRUD removed — slots are created by automation (cron) and public /api/slots. */
router.use('/slots', (req, res) => {
  res.status(410).json({
    error: 'Gone',
    errorCode: 'ADMIN_SLOTS_DEPRECATED',
    message:
      'Admin slot management has been removed. Slots are auto-generated; use GET /api/slots for read-only access if needed.'
  });
});

// Get settings
router.get('/settings', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM settings ORDER BY key');
    
    // Convert to object format
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = {
        value: row.value,
        description: row.description,
        updated_at: row.updated_at,
        updated_by: row.updated_by
      };
    });

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// Update settings
router.put('/settings', validateSettingsUpdate, async (req, res, next) => {
  try {
    const settings = req.body;
    const userId = req.user.id;

    for (const [key, data] of Object.entries(settings)) {
      const { value } = data;
      
      await db.query(`
        INSERT INTO settings (key, value, description, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      `, [key, JSON.stringify(value), data.description || '', userId]);
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Update booking status
router.put('/bookings/:id/status', validateBookingStatusUpdate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log(`[Admin] Updating booking ${id} status to: ${status}`);

    if (!status) {
      const error = new Error('Status is required');
      error.status = 400;
      error.errorCode = 'STATUS_REQUIRED';
      return next(error);
    }

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      const error = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      error.status = 400;
      error.errorCode = 'INVALID_STATUS';
      return next(error);
    }

    // Check if booking exists
    const bookingCheck = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingCheck.rows.length === 0) {
      console.error(`[Admin] Booking not found: ${id}`);
      const error = new Error('Booking not found');
      error.status = 404;
      error.errorCode = 'BOOKING_NOT_FOUND';
      return next(error);
    }

    const oldStatus = bookingCheck.rows[0].status;
    console.log(`[Admin] Booking ${id} status change: ${oldStatus} -> ${status}`);

    // Update booking status
    const result = await db.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      const error = new Error('Booking not found');
      error.status = 404;
      error.errorCode = 'BOOKING_NOT_FOUND';
      return next(error);
    }

    const updatedBooking = result.rows[0];
    console.log(`[Admin] Booking ${id} status updated successfully to: ${updatedBooking.status}`);

    res.json(updatedBooking);
  } catch (error) {
    console.error(`[Admin] Error updating booking status:`, error);
    next(error);
  }
});

// Delete booking
router.delete('/bookings/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      const error = new Error('Booking not found');
      error.status = 404;
      error.errorCode = 'BOOKING_NOT_FOUND';
      return next(error);
    }

    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Create admin user (superadmin only)
router.post('/users', validateUserCreation, async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      const error = new Error('Only superadmins can create admin users');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { email, full_name, phone, role } = req.body;

    if (!email || !full_name || !role) {
      const error = new Error('Missing required fields');
      error.status = 400;
      error.errorCode = 'MISSING_REQUIRED_FIELDS';
      return next(error);
    }

    // Phone is required - generate default if not provided
    if (!phone) {
      const error = new Error('Phone number is required');
      error.status = 400;
      error.errorCode = 'PHONE_REQUIRED';
      return next(error);
    }

    const validRoles = ['customer', 'trainer', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      const error = new Error('Invalid role');
      error.status = 400;
      error.errorCode = 'INVALID_ROLE';
      return next(error);
    }

    const result = await db.query(
      `INSERT INTO profiles (email, full_name, phone, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, phone, role, created_at`,
      [email, full_name, phone, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      const error = new Error('Email already exists');
      error.status = 409;
      error.errorCode = 'DUPLICATE_EMAIL';
      return next(error);
    }
    next(error);
  }
});

// Update user (admin can edit customer details)
router.put('/users/:id', validateUserUpdate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, total_bookings, weekly_booking_count, inactive_blocked } = req.body;

    const beforeSnap = await db.query(
      `SELECT id, email, full_name, phone, role, created_at, total_bookings, last_booking_date, weekly_booking_count, inactive_blocked
       FROM profiles WHERE id = $1`,
      [id]
    );

    if (beforeSnap.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
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
    if (total_bookings !== undefined) {
      updates.push(`total_bookings = $${paramIndex++}`);
      params.push(total_bookings);
    }
    if (weekly_booking_count !== undefined) {
      updates.push(`weekly_booking_count = $${paramIndex++}`);
      params.push(weekly_booking_count);
    }
    if (inactive_blocked !== undefined) {
      updates.push(`inactive_blocked = $${paramIndex++}`);
      params.push(!!inactive_blocked);
    }

    if (updates.length === 0) {
      const error = new Error('No fields to update');
      error.status = 400;
      error.errorCode = 'NO_FIELDS_TO_UPDATE';
      return next(error);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${paramIndex} 
       RETURNING id, email, full_name, phone, role, created_at, total_bookings, last_booking_date, weekly_booking_count, inactive_blocked`,
      params
    );

    if (result.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'UPDATE_USER_PROFILE',
      entityType: 'user',
      entityId: id,
      beforeValue: beforeSnap.rows[0],
      afterValue: result.rows[0],
      details: {}
    });

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      const error = new Error('Phone number or email already exists');
      error.status = 409;
      error.errorCode = 'DUPLICATE_CONTACT';
      return next(error);
    }
    next(error);
  }
});

// Update user role (superadmin only)
router.put('/users/:id/role', validateUserRoleUpdate, async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      const error = new Error('Only superadmins can change user roles');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      const error = new Error('Role is required');
      error.status = 400;
      error.errorCode = 'ROLE_REQUIRED';
      return next(error);
    }

    const validRoles = ['customer', 'trainer', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      const error = new Error('Invalid role');
      error.status = 400;
      error.errorCode = 'INVALID_ROLE';
      return next(error);
    }

    // Get old data for audit
    const oldData = await db.query(
      'SELECT role FROM profiles WHERE id = $1',
      [id]
    );

    const result = await db.query(
      'UPDATE profiles SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, full_name, phone, role, created_at',
      [role, id]
    );

    if (result.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'UPDATE_USER_ROLE',
      entityType: 'user',
      entityId: id,
      beforeValue: oldData.rows[0] || {},
      afterValue: result.rows[0],
      details: {}
    });

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete user (superadmin only)
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      const error = new Error('Only superadmins can delete users');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { id } = req.params;

    if (id === req.user.id) {
      const error = new Error('Cannot delete your own account');
      error.status = 400;
      error.errorCode = 'CANNOT_DELETE_OWN_ACCOUNT';
      return next(error);
    }

    // Get old data for audit
    const oldData = await db.query('SELECT * FROM profiles WHERE id = $1', [id]);

    const result = await db.query('DELETE FROM profiles WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'DELETE_USER',
      entityType: 'user',
      entityId: id,
      beforeValue: oldData.rows[0] || {},
      afterValue: null,
      details: {}
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error.code === '23503') {
      const error = new Error('Cannot delete user. This user has related data that must be removed first');
      error.status = 400;
      error.errorCode = 'CANNOT_DELETE_USER';
      return next(error);
    }
    next(error);
  }
});

// Get admin audit logs (admin only)
router.get('/audit-logs', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { limit = 100, offset = 0, entity_type, action_type, admin_id } = req.query;
    const safeLimit = Number.parseInt(limit, 10);
    const safeOffset = Number.parseInt(offset, 10);
    const finalLimit = Number.isFinite(safeLimit) ? Math.min(Math.max(safeLimit, 1), 1000) : 100;
    const finalOffset = Number.isFinite(safeOffset) ? Math.max(safeOffset, 0) : 0;

    const hasAdminAuditLog = await db
      .query(`SELECT to_regclass('public.admin_audit_log') IS NOT NULL AS exists`)
      .then((r) => !!r.rows[0]?.exists);
    const hasLegacyAuditLog = await db
      .query(`SELECT to_regclass('public.audit_logs') IS NOT NULL AS exists`)
      .then((r) => !!r.rows[0]?.exists);

    if (!hasAdminAuditLog && !hasLegacyAuditLog) {
      return res.json([]);
    }

    const params = [];
    let paramIndex = 1;
    let adminFilterSql = '';
    let legacyFilterSql = '';

    if (entity_type) {
      params.push(entity_type);
      const token = `$${paramIndex++}`;
      adminFilterSql += ` AND al.entity_type = ${token}`;
      legacyFilterSql += ` AND al.entity_type = ${token}`;
    }

    if (action_type) {
      params.push(action_type);
      const token = `$${paramIndex++}`;
      adminFilterSql += ` AND al.action_type = ${token}`;
      legacyFilterSql += ` AND al.action = ${token}`;
    }

    if (admin_id) {
      params.push(admin_id);
      const token = `$${paramIndex++}`;
      adminFilterSql += ` AND al.admin_id = ${token}`;
      legacyFilterSql += ` AND al.user_id = ${token}`;
    }

    let query = '';
    if (hasAdminAuditLog) {
      query = `
        SELECT
          al.id,
          al.admin_id,
          p.full_name as admin_name,
          p.email as admin_email,
          al.action_type,
          al.entity_type,
          al.entity_id,
          al.before_value,
          al.after_value,
          al.details,
          al.created_at
        FROM admin_audit_log al
        LEFT JOIN profiles p ON al.admin_id = p.id
        WHERE 1=1 ${adminFilterSql}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
    } else {
      // Legacy compatibility for deployments still using audit_logs only.
      query = `
        SELECT
          al.id,
          al.user_id as admin_id,
          p.full_name as admin_name,
          p.email as admin_email,
          al.action as action_type,
          al.entity_type,
          al.entity_id,
          NULL::jsonb as before_value,
          al.changes as after_value,
          al.changes as details,
          al.created_at
        FROM audit_logs al
        LEFT JOIN profiles p ON al.user_id = p.id
        WHERE 1=1 ${legacyFilterSql}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
    }

    params.push(finalLimit, finalOffset);
    const result = await db.query(query, params);
    res.json(result.rows || []);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
