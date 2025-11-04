const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// Get slots with various filters
router.get('/', async (req, res, next) => {
  try {
    const { trainer_id, start_date, end_date, date, status, available_only } = req.query;

    let query = `
      SELECT s.*,
             t.user_id as trainer_user_id,
             t.id as trainer_id,
             p.full_name as trainer_name,
             t.is_active as trainer_is_active,
             CASE 
               WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name='slots' AND column_name='slot_date') 
               THEN s.slot_date 
               ELSE s.start_time::date 
             END as slot_date,
             CASE 
               WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name='slots' AND column_name='is_auto_generated') 
               THEN s.is_auto_generated 
               ELSE false 
             END as is_auto_generated,
             json_build_object(
               'id', t.id,
               'profile', json_build_object(
                 'full_name', p.full_name
               )
             ) as trainer
      FROM slots s
      LEFT JOIN trainers t ON s.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (available_only === 'true') {
      query += ` AND s.status = 'available' AND s.status != 'disabled' AND t.is_active = true`;
    } else if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    } else {
      // Exclude disabled slots by default unless explicitly requested
      query += ` AND s.status != 'disabled'`;
    }

    if (trainer_id) {
      params.push(trainer_id);
      query += ` AND s.trainer_id = $${params.length}`;
    } else if (available_only === 'true') {
      query += ` AND s.trainer_id IS NOT NULL AND t.is_active = true`;
    }

    // Support both slot_date column and date filtering by start_time
    if (date) {
      params.push(date);
      query += ` AND (
        (EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='slots' AND column_name='slot_date') 
         AND s.slot_date = $${params.length})
        OR 
        (NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='slots' AND column_name='slot_date') 
         AND s.start_time::date = $${params.length})
      )`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND s.start_time >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND s.start_time <= $${params.length}`;
    }

    query += ' ORDER BY s.start_time ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get slots by date
router.get('/date/:date', async (req, res, next) => {
  try {
    const { date } = req.params;
    
    // Check if slot_date column exists
    const hasSlotDate = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='slots' AND column_name='slot_date'
      ) as exists
    `).then(r => r.rows[0].exists);

    let query;
    if (hasSlotDate) {
      query = `
        SELECT s.*,
               CASE WHEN s.slot_date IS NOT NULL THEN s.slot_date ELSE s.start_time::date END as slot_date,
               t.id as trainer_id,
               json_build_object(
                 'id', t.id,
                 'profile', json_build_object(
                   'full_name', p.full_name
                 )
               ) as trainer
        FROM slots s
        LEFT JOIN trainers t ON s.trainer_id = t.id
        LEFT JOIN profiles p ON t.user_id = p.id
        WHERE s.slot_date = $1 OR (s.slot_date IS NULL AND s.start_time::date = $1)
        ORDER BY s.start_time ASC
      `;
    } else {
      query = `
        SELECT s.*,
               s.start_time::date as slot_date,
               t.id as trainer_id,
               json_build_object(
                 'id', t.id,
                 'profile', json_build_object(
                   'full_name', p.full_name
                 )
               ) as trainer
        FROM slots s
        LEFT JOIN trainers t ON s.trainer_id = t.id
        LEFT JOIN profiles p ON t.user_id = p.id
        WHERE s.start_time::date = $1
        ORDER BY s.start_time ASC
      `;
    }

    const result = await db.query(query, [date]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get slots by date range
router.get('/range', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    console.log('Range endpoint called:', { start_date, end_date });
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    const result = await db.query(`
      SELECT s.*,
             t.id as trainer_id,
             json_build_object(
               'id', t.id,
               'profile', json_build_object(
                 'full_name', p.full_name
               )
             ) as trainer
      FROM slots s
      LEFT JOIN trainers t ON s.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      WHERE s.start_time >= $1 AND s.start_time <= $2
      ORDER BY s.start_time ASC
    `, [start_date, end_date]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get available slots
router.get('/available', async (req, res, next) => {
  try {
    const { date } = req.query;
    let query = `
      SELECT s.*,
             t.id as trainer_id,
             json_build_object(
               'id', t.id,
               'profile', json_build_object(
                 'full_name', p.full_name
               )
             ) as trainer
      FROM slots s
      LEFT JOIN trainers t ON s.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      WHERE s.status = 'available' 
        AND s.status != 'disabled'
        AND s.trainer_id IS NOT NULL
        AND s.booked_count < s.capacity
        AND t.is_active = true
    `;
    const params = [];

    if (date) {
      params.push(date);
      query += ` AND (
        (EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='slots' AND column_name='slot_date') 
         AND s.slot_date = $1)
        OR 
        (NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='slots' AND column_name='slot_date') 
         AND s.start_time::date = $1)
      )`;
    }

    query += ' ORDER BY s.start_time ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get slot by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT s.*,
             t.id as trainer_id,
             json_build_object(
               'id', t.id,
               'profile', json_build_object(
                 'full_name', p.full_name
               )
             ) as trainer
      FROM slots s
      LEFT JOIN trainers t ON s.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      WHERE s.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create slot (admin only)
router.post('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { trainer_id, start_time, end_time, capacity, status, slot_date, is_auto_generated } = req.body;

    const result = await db.query(`
      INSERT INTO slots (trainer_id, start_time, end_time, capacity, status${slot_date ? ', slot_date' : ''}${is_auto_generated !== undefined ? ', is_auto_generated' : ''})
      VALUES ($1, $2, $3, $4, $5${slot_date ? ', $6' : ''}${is_auto_generated !== undefined ? (slot_date ? ', $7' : ', $6') : ''})
      RETURNING *
    `, slot_date && is_auto_generated !== undefined 
      ? [trainer_id, start_time, end_time, capacity || 1, status || 'available', slot_date, is_auto_generated]
      : slot_date 
        ? [trainer_id, start_time, end_time, capacity || 1, status || 'available', slot_date]
        : is_auto_generated !== undefined
          ? [trainer_id, start_time, end_time, capacity || 1, status || 'available', is_auto_generated]
          : [trainer_id, start_time, end_time, capacity || 1, status || 'available']);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update slot trainer (admin only)
router.put('/:id/trainer', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { trainer_id } = req.body;
    
    await db.query(`
      UPDATE slots 
      SET trainer_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [trainer_id || null, req.params.id]);

    // Fetch updated slot with trainer info
    const result = await db.query(`
      SELECT s.*,
        json_build_object(
          'id', t.id,
          'profile', json_build_object(
            'full_name', p.full_name
          )
        ) as trainer
      FROM slots s
      LEFT JOIN trainers t ON s.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      WHERE s.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Toggle slot status (admin only)
router.put('/:id/status', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { status } = req.body;
    if (!status || !['available', 'cancelled', 'full', 'completed', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: available, cancelled, full, completed, or disabled' });
    }

    const result = await db.query(`
      UPDATE slots 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Toggle slot enable/disable (admin only)
router.put('/:id/toggle', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const slotResult = await db.query(`
      SELECT status, booked_count FROM slots WHERE id = $1
    `, [req.params.id]);

    if (slotResult.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    const slot = slotResult.rows[0];
    
    // Don't allow disabling if slot has bookings
    if (slot.booked_count > 0 && slot.status !== 'disabled') {
      return res.status(400).json({ error: 'Cannot disable slot with existing bookings' });
    }

    const newStatus = slot.status === 'disabled' ? 'available' : 'disabled';

    const result = await db.query(`
      UPDATE slots 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [newStatus, req.params.id]);

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update slot (admin only)
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { trainer_id, start_time, end_time, capacity, status, booked_count } = req.body;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (trainer_id !== undefined) {
      updates.push(`trainer_id = $${paramIndex++}`);
      params.push(trainer_id);
    }
    if (start_time !== undefined) {
      updates.push(`start_time = $${paramIndex++}`);
      params.push(start_time);
    }
    if (end_time !== undefined) {
      updates.push(`end_time = $${paramIndex++}`);
      params.push(end_time);
    }
    if (capacity !== undefined) {
      updates.push(`capacity = $${paramIndex++}`);
      params.push(capacity);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (booked_count !== undefined) {
      updates.push(`booked_count = $${paramIndex++}`);
      params.push(booked_count);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);

    await db.query(`
      UPDATE slots 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);

    // Fetch updated slot with trainer info
    const result = await db.query(`
      SELECT s.*,
        json_build_object(
          'id', t.id,
          'profile', json_build_object(
            'full_name', p.full_name
          )
        ) as trainer
      FROM slots s
      LEFT JOIN trainers t ON s.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      WHERE s.id = $${paramIndex}
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete slot (admin only)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await db.query('DELETE FROM slots WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete slots by date (admin only)
router.delete('/date/:date', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { date } = req.params;
    await db.query(`
      DELETE FROM slots 
      WHERE (
        (EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='slots' AND column_name='slot_date') 
         AND slot_date = $1)
        OR 
        (NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='slots' AND column_name='slot_date') 
         AND start_time::date = $1)
      )
    `, [date]);

    res.json({ message: 'Slots deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Generate daily slots (admin only) - Auto-generates if missing
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { date } = req.body;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const dateString = targetDate.toISOString().split('T')[0];

    // Check column existence once
    const hasSlotDate = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='slots' AND column_name='slot_date'
      ) as exists
    `).then(r => r.rows[0].exists);

    const hasIsAutoGenerated = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='slots' AND column_name='is_auto_generated'
      ) as exists
    `).then(r => r.rows[0].exists);

    // Check if slots already exist for this date
    let existingCheck;
    if (hasSlotDate && hasIsAutoGenerated) {
      existingCheck = await db.query(`
        SELECT id FROM slots 
        WHERE slot_date = $1 
          AND trainer_id IS NULL 
          AND is_auto_generated = true
        LIMIT 1
      `, [dateString]);
    } else if (hasSlotDate) {
      existingCheck = await db.query(`
        SELECT id FROM slots 
        WHERE slot_date = $1 AND trainer_id IS NULL
        LIMIT 1
      `, [dateString]);
    } else {
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      existingCheck = await db.query(`
        SELECT id FROM slots 
        WHERE start_time >= $1 
          AND start_time <= $2 
          AND trainer_id IS NULL
        LIMIT 1
      `, [startOfDay.toISOString(), endOfDay.toISOString()]);
    }

    if (existingCheck.rows.length > 0) {
      return res.json({
        success: false,
        message: 'Slots already generated for this date',
        date: dateString
      });
    }

    // Generate slots (9 AM to 9 PM, 30-minute intervals)
    const slots = [];
    const config = {
      startHour: 9,
      startMinute: 0,
      endHour: 21,
      endMinute: 0,
      intervalMinutes: 30
    };

    let currentTime = new Date(targetDate);
    currentTime.setHours(config.startHour, config.startMinute, 0, 0);
    const endTime = new Date(targetDate);
    endTime.setHours(config.endHour, config.endMinute, 0, 0);

    while (currentTime < endTime) {
      const slotStart = new Date(currentTime);
      currentTime.setMinutes(currentTime.getMinutes() + config.intervalMinutes);
      const slotEnd = new Date(currentTime);

      const slot = {
        trainer_id: null,
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        capacity: 1,
        booked_count: 0,
        status: 'available'
      };

      if (hasSlotDate) {
        slot.slot_date = dateString;
      }
      if (hasIsAutoGenerated) {
        slot.is_auto_generated = true;
      }

      slots.push(slot);
    }

    // Insert slots
    for (const slot of slots) {
      if (hasSlotDate && hasIsAutoGenerated) {
        await db.query(`
          INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status, slot_date, is_auto_generated)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [slot.trainer_id, slot.start_time, slot.end_time, slot.capacity, slot.booked_count, slot.status, slot.slot_date, slot.is_auto_generated]);
      } else if (hasSlotDate) {
        await db.query(`
          INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status, slot_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [slot.trainer_id, slot.start_time, slot.end_time, slot.capacity, slot.booked_count, slot.status, slot.slot_date]);
      } else if (hasIsAutoGenerated) {
        await db.query(`
          INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status, is_auto_generated)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [slot.trainer_id, slot.start_time, slot.end_time, slot.capacity, slot.booked_count, slot.status, slot.is_auto_generated]);
      } else {
        await db.query(`
          INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [slot.trainer_id, slot.start_time, slot.end_time, slot.capacity, slot.booked_count, slot.status]);
      }
    }

    res.json({
      success: true,
      message: `Generated ${slots.length} slots for ${dateString}`,
      slotsCreated: slots.length,
      date: dateString
    });
  } catch (error) {
    next(error);
  }
});

// Generate daily slots (admin only) - Legacy endpoint for backward compatibility
router.post('/generate-daily', authenticate, async (req, res, next) => {
  // Forward to new endpoint
  req.url = '/generate';
  router.handle(req, res, next);
});

// Auto-generate slots for today if missing (public endpoint, can be called by cron)
router.post('/ensure-daily', async (req, res, next) => {
  try {
    const { date } = req.body;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const dateString = targetDate.toISOString().split('T')[0];

    // Use database function if available, otherwise generate manually
    const hasFunction = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'ensure_daily_slots'
      ) as exists
    `).then(r => r.rows[0].exists);

    let slotsCreated = 0;
    if (hasFunction) {
      const result = await db.query('SELECT ensure_daily_slots($1::date) as count', [dateString]);
      slotsCreated = result.rows[0].count || 0;
    } else {
      // Fallback to manual generation
      const result = await db.query(`
        SELECT COUNT(*) as count FROM slots 
        WHERE slot_date = $1 AND is_auto_generated = true
      `, [dateString]);
      
      if (parseInt(result.rows[0].count) === 0) {
        // Generate slots
        const generateResult = await db.query(`
          INSERT INTO slots (trainer_id, start_time, end_time, slot_date, capacity, booked_count, status, is_auto_generated)
          SELECT 
            NULL,
            generate_series(
              $1::date + INTERVAL '9 hours',
              $1::date + INTERVAL '21 hours',
              INTERVAL '30 minutes'
            )::timestamptz as start_time,
            generate_series(
              $1::date + INTERVAL '9 hours 30 minutes',
              $1::date + INTERVAL '21 hours 30 minutes',
              INTERVAL '30 minutes'
            )::timestamptz as end_time,
            $1::date,
            1, 0, 'available', true
          ON CONFLICT DO NOTHING
          RETURNING id
        `, [dateString]);
        slotsCreated = generateResult.rows.length;
      }
    }

    res.json({
      success: true,
      message: `Ensured slots exist for ${dateString}`,
      slotsCreated: slotsCreated,
      date: dateString
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
