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
router.post('/trainers', async (req, res, next) => {
  try {
    const { email, full_name, phone, bio, experience_years, specialization, rating } = req.body;

    if (!email || !full_name || !bio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const profileResult = await client.query(
        `INSERT INTO profiles (email, full_name, phone, role)
         VALUES ($1, $2, $3, 'trainer')
         RETURNING id`,
        [email, full_name, phone || null]
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
      return res.status(409).json({ error: 'Email already exists' });
    }
    next(error);
  }
});

// Update trainer
router.put('/trainers/:id', async (req, res, next) => {
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
      return res.status(400).json({ error: 'No fields to update' });
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
        return res.status(404).json({ error: 'Trainer not found' });
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
      return res.status(400).json({
        error: 'Cannot delete trainer with existing bookings',
        message: 'Please cancel or complete all bookings for this trainer first'
      });
    }

    const result = await db.query('DELETE FROM trainers WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    res.json({ message: 'Trainer deleted successfully' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Cannot delete trainer',
        message: 'This trainer has related data that must be removed first'
      });
    }
    next(error);
  }
});

// Get all slots with trainer information
router.get('/slots', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT s.*,
             t.id as trainer_table_id,
             p.id as trainer_profile_id, p.full_name as trainer_name, p.email as trainer_email
      FROM slots s
      JOIN trainers t ON s.trainer_id = t.id
      JOIN profiles p ON t.user_id = p.id
      ORDER BY s.start_time DESC
    `);

    // Format response to match frontend expectations
    const slots = result.rows.map(row => ({
      id: row.id,
      trainer_id: row.trainer_id,
      start_time: row.start_time,
      end_time: row.end_time,
      capacity: row.capacity,
      booked_count: row.booked_count,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      trainer: {
        id: row.trainer_table_id,
        profile: {
          id: row.trainer_profile_id,
          full_name: row.trainer_name,
          email: row.trainer_email
        }
      }
    }));

    res.json(slots);
  } catch (error) {
    next(error);
  }
});

// Create slot
router.post('/slots', async (req, res, next) => {
  try {
    const { trainer_id, start_time, end_time, capacity } = req.body;

    if (!trainer_id || !start_time || !end_time || !capacity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(`
      INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status)
      VALUES ($1, $2, $3, $4, 0, 'available')
      RETURNING *
    `, [trainer_id, start_time, end_time, capacity]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Slot already exists at this time' });
    }
    next(error);
  }
});

// Update slot
router.put('/slots/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { start_time, end_time, capacity, status } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (start_time !== undefined) {
      updates.push(`start_time = $${paramCount++}`);
      values.push(start_time);
    }
    if (end_time !== undefined) {
      updates.push(`end_time = $${paramCount++}`);
      values.push(end_time);
    }
    if (capacity !== undefined) {
      updates.push(`capacity = $${paramCount++}`);
      values.push(capacity);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE slots SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete slot
router.delete('/slots/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const bookingsCheck = await db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE slot_id = $1',
      [id]
    );

    if (parseInt(bookingsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete slot with existing bookings',
        message: 'Please cancel all bookings for this slot first'
      });
    }

    const result = await db.query('DELETE FROM slots WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Cannot delete slot',
        message: 'This slot has related bookings that must be removed first'
      });
    }
    next(error);
  }
});

// Get audit logs
router.get('/audit', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT a.*,
             p.full_name, p.email
      FROM audit_logs a
      LEFT JOIN profiles p ON a.user_id = p.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);

    // Format response
    const logs = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      old_data: row.old_data,
      new_data: row.new_data,
      ip_address: row.ip_address,
      created_at: row.created_at,
      user: row.user_id ? {
        full_name: row.full_name,
        email: row.email
      } : null
    }));

    res.json(logs);
  } catch (error) {
    next(error);
  }
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
router.put('/settings', async (req, res, next) => {
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
router.put('/bookings/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete booking
router.delete('/bookings/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Create admin user (superadmin only)
router.post('/users', async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can create admin users' });
    }

    const { email, full_name, phone, role } = req.body;

    if (!email || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validRoles = ['customer', 'trainer', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await db.query(
      `INSERT INTO profiles (email, full_name, phone, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, phone, role, created_at`,
      [email, full_name, phone || null, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    next(error);
  }
});

// Update user role (superadmin only)
router.put('/users/:id/role', async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can change user roles' });
    }

    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const validRoles = ['customer', 'trainer', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await db.query(
      'UPDATE profiles SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, full_name, phone, role, created_at',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete user (superadmin only)
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can delete users' });
    }

    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query('DELETE FROM profiles WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Cannot delete user',
        message: 'This user has related data that must be removed first'
      });
    }
    next(error);
  }
});

module.exports = router;
