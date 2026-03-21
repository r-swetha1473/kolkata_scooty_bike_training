const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateSlotCreation, validateSlotUpdate } = require('../validators');
const config = require('../app.config');
const { SLOT_CAPACITY, CANCELLATION_WINDOW_HOURS, SLOT_VISIBILITY_HOURS } = require('../config/app.config');
const vehicleService = require('../services/vehicle.service');
const auditService = require('../services/audit.service');
const router = express.Router();
const events = require('../events');
const { normalizeDate, addDays, getDayOfWeek, getToday } = require('../utils/dateUtils');

// Get slots with various filters
router.get('/', async (req, res, next) => {
  try {
    const { trainer_id, start_date, end_date, date, status, available_only } = req.query;

    // Dynamic vehicle capacity: Use slot_vehicle_capacity table instead of hardcoded columns
    // Calculate booked counts per vehicle dynamically from bookings table
    // Handle case where slot_vehicle_capacity table might not exist (graceful fallback)
    let query = `
      SELECT s.*,
             t.user_id as trainer_user_id,
             t.id as trainer_id,
             p.full_name as trainer_name,
             t.is_active as trainer_is_active,
             json_build_object(
               'id', t.id,
               'profile', json_build_object(
                 'full_name', p.full_name
               )
             ) as trainer,
             -- Get vehicle capacities and booked counts dynamically
             COALESCE(
               json_agg(
                 DISTINCT jsonb_build_object(
                   'vehicle_id', v.id,
                   'vehicle_name', v.name,
                   'capacity', svc.capacity,
                   'booked', COALESCE(vehicle_booked.booked_count, 0)
                 )
               ) FILTER (WHERE v.id IS NOT NULL),
               '[]'::json
             ) as vehicle_capacities
      FROM slots s
      LEFT JOIN trainers t ON s.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      LEFT JOIN slot_vehicle_capacity svc ON svc.slot_id = s.id
      LEFT JOIN vehicles v ON svc.vehicle_id = v.id AND v.is_active = true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as booked_count
        FROM bookings b
        WHERE b.slot_id = s.id AND b.vehicle_id = v.id AND b.status NOT IN ('cancelled')
      ) vehicle_booked ON true
      WHERE 1=1
    `;

    const params = [];

    if (available_only === 'true') {
      query += ` AND s.status = '${config.slot.defaultStatus}' AND s.status != 'disabled'`;
      query += ` AND (t.id IS NULL OR t.is_active = true)`;
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
    }

    // Filter by slot_date
    if (date) {
      params.push(date);
      query += ` AND (s.slot_date = $${params.length}::date OR s.start_time::date = $${params.length}::date)`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND s.start_time >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND s.start_time <= $${params.length}`;
    }

    query += ` GROUP BY s.id, s.trainer_id, s.start_time, s.end_time, s.slot_date, s.capacity, s.booked_count, 
                      s.status, s.is_auto_generated, s.is_visible, s.created_at, s.updated_at,
                      t.id, t.user_id, t.is_active, p.full_name
               ORDER BY s.start_time ASC`;

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
    
    // Ensure slot_vehicle_capacity table exists and has entries for all slots
    // This is a safety check - if table doesn't exist, the query will fail gracefully
    try {
      // Check if table exists first
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'slot_vehicle_capacity'
        ) as exists
      `);
      
      if (!tableExists.rows[0]?.exists) {
        const migrationError = new Error(
          'Database migration required: slot_vehicle_capacity table does not exist. ' +
          'Please run: node backend/apply_migration.js supabase/migrations/20260125000004_fix_slot_vehicle_capacity_schema.sql'
        );
        migrationError.status = 500;
        migrationError.errorCode = 'MIGRATION_REQUIRED';
        throw migrationError;
      }
      
      // Ensure all slots for this date have vehicle capacity entries
      const slotsToEnsure = await db.query(`
        SELECT id FROM slots 
        WHERE (slot_date = $1::date OR start_time::date = $1::date)
      `, [date]);
      
      for (const slotRow of slotsToEnsure.rows) {
        try {
          await db.query('SELECT ensure_slot_vehicle_capacities($1)', [slotRow.id]);
        } catch (err) {
          // Function might not exist yet, ignore
          if (!err.message.includes('function') && !err.message.includes('does not exist')) {
            console.warn(`Failed to ensure capacities for slot ${slotRow.id}:`, err.message);
          }
        }
      }
    } catch (ensureError) {
      // If migration error, propagate it
      if (ensureError.errorCode === 'MIGRATION_REQUIRED') {
        return next(ensureError);
      }
      // If ensure function doesn't exist or table doesn't exist, continue anyway
      // The query below will handle the error
      console.warn('Could not ensure slot vehicle capacities:', ensureError.message);
    }
    
    // Dynamic vehicle capacity: Use slot_vehicle_capacity table
    // Calculate booked counts per vehicle dynamically from bookings table
    const result = await db.query(`
      SELECT s.*,
             CASE WHEN s.slot_date IS NOT NULL THEN s.slot_date ELSE s.start_time::date END as slot_date,
             t.id as trainer_id,
             CASE 
               WHEN t.id IS NOT NULL THEN
                 json_build_object(
                   'id', t.id,
                   'profile', json_build_object(
                     'full_name', p.full_name
                   )
                 )
               ELSE NULL
             END as trainer,
             -- Get vehicle capacities and booked counts dynamically
             COALESCE(
               json_agg(
                 DISTINCT jsonb_build_object(
                   'vehicle_id', v.id,
                   'vehicle_name', v.name,
                   'capacity', svc.capacity,
                   'booked', COALESCE(vehicle_booked.booked_count, 0)
                 )
               ) FILTER (WHERE v.id IS NOT NULL),
               '[]'::json
             ) as vehicle_capacities
      FROM slots s
      LEFT JOIN trainers t ON s.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      LEFT JOIN slot_vehicle_capacity svc ON svc.slot_id = s.id
      LEFT JOIN vehicles v ON svc.vehicle_id = v.id AND v.is_active = true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as booked_count
        FROM bookings b
        WHERE b.slot_id = s.id AND b.vehicle_id = v.id AND b.status NOT IN ('cancelled')
      ) vehicle_booked ON true
      WHERE (s.slot_date = $1::date OR s.start_time::date = $1::date)
      GROUP BY s.id, s.trainer_id, s.start_time, s.end_time, s.slot_date, s.capacity, s.booked_count,
               s.status, s.is_auto_generated, s.is_visible, s.created_at, s.updated_at,
               t.id, t.user_id, t.is_active, p.full_name
      ORDER BY s.start_time ASC
    `, [date]);
    
    res.json(result.rows);
  } catch (error) {
    // Handle PostgreSQL errors gracefully
    if (error.code === '42P01') {
      // Table doesn't exist - provide helpful error message
      const migrationError = new Error(
        'Database migration required: slot_vehicle_capacity table does not exist. ' +
        'Please run: node backend/apply_migration.js supabase/migrations/20260124000000_create_slot_vehicle_capacity.sql'
      );
      migrationError.status = 500;
      migrationError.errorCode = 'MIGRATION_REQUIRED';
      migrationError.originalError = error.message;
      return next(migrationError);
    }
    next(error);
  }
});

// Get slots by date range
router.get('/range', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      const error = new Error('start_date and end_date are required');
      error.status = 400;
      error.errorCode = 'MISSING_PARAMETERS';
      return next(error);
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

// Get available slots (with 24-hour visibility rule)
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
      WHERE s.status = '${config.slot.defaultStatus}' 
        AND s.status != 'disabled'
        AND s.trainer_id IS NOT NULL
        AND s.booked_count < s.capacity
        AND t.is_active = true
        AND s.start_time > NOW()
        AND s.start_time <= (NOW() + INTERVAL '${SLOT_VISIBILITY_HOURS} hours')
    `;
    const params = [];

    if (date) {
      params.push(date);
      query += ` AND (s.slot_date = $${params.length}::date OR s.start_time::date = $${params.length}::date)`;
    }

    query += ' ORDER BY s.start_time ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Update vehicle capacity for a slot (admin only)
router.put('/:id/vehicle-capacity', authenticate, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    await client.query('BEGIN');

    const { id } = req.params;
    const { vehicle_capacities } = req.body; // { vehicle_id: capacity }

    // Get slot
    const slotCheck = await client.query(
      `SELECT id FROM slots WHERE id = $1`,
      [id]
    );

    if (slotCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }

    if (!vehicle_capacities || typeof vehicle_capacities !== 'object') {
      await client.query('ROLLBACK');
      client.release();
      const error = new Error('vehicle_capacities object is required');
      error.status = 400;
      error.errorCode = 'INVALID_REQUEST';
      return next(error);
    }

    // Get current capacities and booked counts for validation
    const currentCapacities = await client.query(
      `SELECT svc.vehicle_id, svc.capacity, v.name as vehicle_name,
              COALESCE((
                SELECT COUNT(*) FROM bookings b 
                WHERE b.slot_id = svc.slot_id AND b.vehicle_id = svc.vehicle_id 
                AND b.status NOT IN ('cancelled')
              ), 0) as booked_count
       FROM slot_vehicle_capacity svc
       JOIN vehicles v ON svc.vehicle_id = v.id
       WHERE svc.slot_id = $1`,
      [id]
    );

    const beforeValues = {};
    const afterValues = {};
    
    // Validate and update each vehicle capacity
    for (const [vehicleId, newCapacity] of Object.entries(vehicle_capacities)) {
      const current = currentCapacities.rows.find(r => String(r.vehicle_id) === String(vehicleId));
      if (!current) {
        await client.query('ROLLBACK');
        client.release();
        const error = new Error(`Vehicle ${vehicleId} not found for this slot`);
        error.status = 400;
        error.errorCode = 'VEHICLE_NOT_FOUND';
        return next(error);
      }

      const newCap = parseInt(newCapacity);
      const booked = parseInt(current.booked_count || 0);

      if (newCap < booked) {
        await client.query('ROLLBACK');
        client.release();
        const error = new Error(`Cannot reduce ${current.vehicle_name} capacity below ${booked} (current bookings)`);
        error.status = 400;
        error.errorCode = 'INVALID_CAPACITY';
        return next(error);
      }

      beforeValues[vehicleId] = current.capacity;
      afterValues[vehicleId] = newCap;

      // Update capacity in slot_vehicle_capacity table
      await client.query(
        `UPDATE slot_vehicle_capacity 
         SET capacity = $1, updated_at = NOW()
         WHERE slot_id = $2 AND vehicle_id = $3`,
        [newCap, id, vehicleId]
      );
    }

    // Update total slot capacity
    const totalCapacity = Object.values(afterValues).reduce((sum, cap) => sum + cap, 0);
    await client.query(
      `UPDATE slots SET capacity = $1, updated_at = NOW() WHERE id = $2`,
      [totalCapacity, id]
    );

    // Log audit trail
    await client.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, entity_type, entity_id, before_value, after_value, details)
       VALUES ($1, 'UPDATE_VEHICLE_CAPACITY', 'slot', $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
      [
        req.user.id,
        id,
        JSON.stringify(beforeValues),
        JSON.stringify(afterValues),
        JSON.stringify({ reason: 'Admin capacity update' })
      ]
    ).catch(err => {
      console.error('[Audit] Failed to log vehicle capacity update:', err);
    });

    const updateResult = await client.query(`SELECT * FROM slots WHERE id = $1`, [id]);

    await client.query('COMMIT');
    client.release();

    res.json({
      success: true,
      slot: updateResult.rows[0],
      message: 'Vehicle capacity updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
});

// Get slot by ID
router.get('/:id', async (req, res, next) => {
  try {
    // Dynamic vehicle capacity: Use slot_vehicle_capacity table
    const result = await db.query(`
      SELECT s.*,
             t.id as trainer_id,
             json_build_object(
               'id', t.id,
               'profile', json_build_object(
                 'full_name', p.full_name
               )
             ) as trainer,
             -- Get vehicle capacities and booked counts dynamically
             json_agg(
               DISTINCT jsonb_build_object(
                 'vehicle_id', v.id,
                 'vehicle_name', v.name,
                 'capacity', svc.capacity,
                 'booked', COALESCE(vehicle_booked.booked_count, 0)
               )
             ) FILTER (WHERE v.id IS NOT NULL) as vehicle_capacities
      FROM slots s
      LEFT JOIN trainers t ON s.trainer_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      LEFT JOIN slot_vehicle_capacity svc ON svc.slot_id = s.id
      LEFT JOIN vehicles v ON svc.vehicle_id = v.id AND v.is_active = true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as booked_count
        FROM bookings b
        WHERE b.slot_id = s.id AND b.vehicle_id = v.id AND b.status NOT IN ('cancelled')
      ) vehicle_booked ON true
      WHERE s.id = $1
      GROUP BY s.id, s.trainer_id, s.start_time, s.end_time, s.slot_date, s.capacity, s.booked_count,
               s.status, s.is_auto_generated, s.is_visible, s.created_at, s.updated_at,
               t.id, t.user_id, t.is_active, p.full_name
    `, [req.params.id]);

    if (result.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create slot (admin only)
router.post('/', authenticate, validateSlotCreation, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { trainer_id, start_time, end_time, capacity, status, slot_date, is_auto_generated, vehicle_capacities } = req.body;

    // Enforce capacity must match config (no defaults, no other values)
    const finalCapacity = SLOT_CAPACITY.DEFAULT;
    
    // Get all active vehicles dynamically
    const vehicles = await vehicleService.getActiveVehicles();
    if (vehicles.length === 0) {
      const error = new Error('No active vehicles found. Please create vehicles first.');
      error.status = 400;
      error.errorCode = 'NO_VEHICLES';
      return next(error);
    }
    
    // Process vehicle capacities: use provided values or default to vehicle.max_per_slot
    const vehicleCapacityMap = new Map();
    if (vehicle_capacities && typeof vehicle_capacities === 'object') {
      // Use provided capacities
      for (const vehicle of vehicles) {
        const providedCapacity = vehicle_capacities[vehicle.id];
        vehicleCapacityMap.set(vehicle.id, providedCapacity !== undefined ? parseInt(providedCapacity) : vehicle.max_per_slot);
      }
    } else {
      // Use default max_per_slot for each vehicle
      for (const vehicle of vehicles) {
        vehicleCapacityMap.set(vehicle.id, vehicle.max_per_slot);
      }
    }
    
    // Validate total capacity matches configured total (if config exists)
    const totalCapacity = Array.from(vehicleCapacityMap.values()).reduce((sum, cap) => sum + cap, 0);
    if (config.slot.vehicleCapacity?.total && totalCapacity !== config.slot.vehicleCapacity.total) {
      // Warn but don't fail - allow flexible capacity totals
      console.warn(`Slot capacity total (${totalCapacity}) does not match config total (${config.slot.vehicleCapacity.total})`);
    }

    // Auto-derive slot_date from start_time if not provided or if mismatched
    let finalSlotDate = slot_date;
    if (start_time) {
      const startDate = new Date(start_time);
      const derivedDate = startDate.toISOString().split('T')[0];
      // Always use the date from start_time to ensure consistency
      finalSlotDate = derivedDate;
    }

    // PHASE 5: Fix MBR-001 - Slot open rule clarification
    // Business rule: "Slots open exactly 24 hours before start time"
    // Implementation: Slot becomes visible and bookable WHEN current_time >= slot_start_time - 24 hours
    // This is deterministic: slot is visible if slot_start_time <= current_time + 24 hours
    // Formula: isVisible = slotStartTime <= (now + 24 hours)
    let isVisible = true;
    if (start_time) {
      const slotStartTime = new Date(start_time);
      const visibilityThreshold = new Date(Date.now() + SLOT_VISIBILITY_HOURS * 60 * 60 * 1000);
      const now = new Date();
      isVisible = slotStartTime > now && slotStartTime <= visibilityThreshold;
    }

    // Insert slot (without vehicle capacity columns)
    const result = await db.query(`
      INSERT INTO slots (trainer_id, start_time, end_time, capacity, status, slot_date, is_auto_generated, is_visible)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      trainer_id, 
      start_time, 
      end_time, 
      finalCapacity, 
      status || config.slot.defaultStatus, 
      finalSlotDate, 
      is_auto_generated !== undefined ? is_auto_generated : false, 
      isVisible
    ]);

    const created = result.rows[0];
    
    // Insert vehicle capacities into slot_vehicle_capacity table
    // Check if table exists first
    try {
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'slot_vehicle_capacity'
        ) as exists
      `);
      
      if (tableCheck.rows[0]?.exists) {
        for (const [vehicleId, capacity] of vehicleCapacityMap.entries()) {
          await db.query(`
            INSERT INTO slot_vehicle_capacity (slot_id, vehicle_id, capacity)
            VALUES ($1, $2, $3)
            ON CONFLICT (slot_id, vehicle_id) DO UPDATE SET capacity = EXCLUDED.capacity
          `, [created.id, vehicleId, capacity]);
        }
        
        // Ensure all active vehicles have capacity entries (use default max_per_slot for any missing)
        try {
          await db.query('SELECT ensure_slot_vehicle_capacities($1)', [created.id]);
        } catch (funcError) {
          // Function might not exist, skip
          if (!funcError.message.includes('does not exist')) {
            console.warn(`Failed to ensure capacities for slot ${created.id}:`, funcError.message);
          }
        }
      } else {
        console.warn('slot_vehicle_capacity table does not exist. Skipping vehicle capacity insertion.');
      }
    } catch (capacityError) {
      // If table doesn't exist, log warning but continue
      if (capacityError.code === '42P01' || capacityError.message.includes('does not exist')) {
        console.warn('Could not insert vehicle capacities:', capacityError.message);
      } else {
        throw capacityError;
      }
    }
    
    // Log audit trail
    await auditService.logSlotCreate(req.user.id, created);
    
    res.status(201).json(created);
    events.broadcast('slot.created', created);
  } catch (error) {
    next(error);
  }
});

// Update slot trainer (admin only)
router.put('/:id/trainer', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    // Get current slot data for audit
    const beforeResult = await db.query('SELECT * FROM slots WHERE id = $1', [req.params.id]);
    if (beforeResult.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }
    const beforeData = beforeResult.rows[0];

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
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }

    const updated = result.rows[0];
    
    // Log audit trail
    await auditService.logSlotUpdate(req.user.id, req.params.id, beforeData, updated);
    
    res.json(updated);
    events.broadcast('slot.assigned', updated);
  } catch (error) {
    next(error);
  }
});

// Toggle slot status (admin only)
router.put('/:id/status', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    // Get current slot data for audit
    const beforeResult = await db.query('SELECT * FROM slots WHERE id = $1', [req.params.id]);
    if (beforeResult.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }
    const beforeData = beforeResult.rows[0];

    const { status } = req.body;
    if (!status || !config.slot.validStatuses.includes(status)) {
      const error = new Error(`Invalid status. Must be: ${config.slot.validStatuses.join(', ')}`);
      error.status = 400;
      error.errorCode = 'INVALID_STATUS';
      return next(error);
    }

    const result = await db.query(`
      UPDATE slots 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, req.params.id]);

    if (result.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }

    const updated = result.rows[0];
    
    // Log audit trail
    await auditService.logSlotUpdate(req.user.id, req.params.id, beforeData, updated);
    
    res.json(updated);
    events.broadcast('slot.status', updated);
  } catch (error) {
    next(error);
  }
});

// Toggle slot enable/disable (admin only)
router.put('/:id/toggle', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    // Get current slot data for audit
    const beforeResult = await db.query('SELECT * FROM slots WHERE id = $1', [req.params.id]);
    if (beforeResult.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }
    const beforeData = beforeResult.rows[0];
    
    // Don't allow disabling if slot has bookings
    if (beforeData.booked_count > 0 && beforeData.status !== 'disabled') {
      const error = new Error('Cannot disable slot with existing bookings');
      error.status = 400;
      error.errorCode = 'CANNOT_DISABLE_SLOT';
      return next(error);
    }

    const newStatus = beforeData.status === 'disabled' ? config.slot.defaultStatus : 'disabled';

    const result = await db.query(`
      UPDATE slots 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [newStatus, req.params.id]);

    const updated = result.rows[0];
    
    // Log audit trail
    await auditService.logSlotUpdate(req.user.id, req.params.id, beforeData, updated);
    
    res.json(updated);
    events.broadcast('slot.toggled', updated);
  } catch (error) {
    next(error);
  }
});

// Update slot (admin only)
router.put('/:id', authenticate, validateSlotUpdate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    // Get current slot data for audit
    const beforeResult = await db.query('SELECT * FROM slots WHERE id = $1', [req.params.id]);
    if (beforeResult.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }
    const beforeData = beforeResult.rows[0];

    const { trainer_id, start_time, end_time, capacity, status, booked_count, slot_date } = req.body;
    
    // Auto-derive slot_date from start_time if start_time is being updated
    let finalSlotDate = slot_date;
    if (start_time) {
      const startDate = new Date(start_time);
      if (isNaN(startDate.getTime())) {
        const error = new Error('Invalid start_time format');
        error.status = 400;
        error.errorCode = 'INVALID_DATE_FORMAT';
        return next(error);
      }
      finalSlotDate = startDate.toISOString().split('T')[0];
    } else if (slot_date) {
      // Ensure slot_date is in YYYY-MM-DD format
      const slotDateObj = new Date(slot_date);
      if (isNaN(slotDateObj.getTime())) {
        const error = new Error('Invalid slot_date format');
        error.status = 400;
        error.errorCode = 'INVALID_DATE_FORMAT';
        return next(error);
      }
      finalSlotDate = slotDateObj.toISOString().split('T')[0];
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (trainer_id !== undefined) {
      updates.push(`trainer_id = $${paramIndex++}`);
      params.push(trainer_id);
    }
    if (start_time !== undefined) {
      updates.push(`start_time = $${paramIndex++}`);
      // Ensure date is properly formatted as ISO string
      const startTimeValue = start_time instanceof Date ? start_time.toISOString() : start_time;
      params.push(startTimeValue);
    }
    if (end_time !== undefined) {
      updates.push(`end_time = $${paramIndex++}`);
      // Ensure date is properly formatted as ISO string
      const endTimeValue = end_time instanceof Date ? end_time.toISOString() : end_time;
      params.push(endTimeValue);
    }
    if (capacity !== undefined) {
      // Enforce max capacity
      const finalCapacity = Math.min(capacity, SLOT_CAPACITY.MAX);
      updates.push(`capacity = $${paramIndex++}`);
      params.push(finalCapacity);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (booked_count !== undefined) {
      updates.push(`booked_count = $${paramIndex++}`);
      params.push(booked_count);
    }
    if (finalSlotDate !== undefined) {
      updates.push(`slot_date = $${paramIndex++}`);
      // Ensure date is properly formatted as YYYY-MM-DD string
      const slotDateValue = finalSlotDate instanceof Date 
        ? finalSlotDate.toISOString().split('T')[0] 
        : finalSlotDate;
      params.push(slotDateValue);
    }

    // PHASE 5: Fix MBR-001 - Update visibility if start_time is being changed (24-hour rule)
    // Slot becomes visible when current_time >= slot_start_time - 24 hours
    if (start_time !== undefined) {
      const slotStartTime = new Date(start_time);
      const visibilityThreshold = new Date(Date.now() + SLOT_VISIBILITY_HOURS * 60 * 60 * 1000);
      const now = new Date();
      const isVisible = slotStartTime > now && slotStartTime <= visibilityThreshold;
      updates.push(`is_visible = $${paramIndex++}::boolean`);
      params.push(isVisible);
    }

    if (updates.length === 0) {
      const error = new Error('No updates provided');
      error.status = 400;
      error.errorCode = 'NO_UPDATES_PROVIDED';
      return next(error);
    }

    // Ensure booked_count doesn't exceed capacity when capacity is updated
    if (capacity !== undefined) {
      const finalCapacity = Math.min(capacity, SLOT_CAPACITY.MAX);
      // Check current booked_count
      const currentSlot = await db.query('SELECT booked_count FROM slots WHERE id = $1', [req.params.id]);
      if (currentSlot.rows.length > 0 && currentSlot.rows[0].booked_count > finalCapacity) {
        const error = new Error(`Cannot reduce capacity below current bookings (${currentSlot.rows[0].booked_count} bookings exist)`);
        error.status = 400;
        error.errorCode = 'CAPACITY_REDUCTION_ERROR';
        return next(error);
      }
    }

    // Check for duplicate slots before updating (excluding current slot)
    // Get current slot values and new values to check for duplicates
    const currentSlotCheck = await db.query('SELECT trainer_id, start_time, slot_date FROM slots WHERE id = $1', [req.params.id]);
    if (currentSlotCheck.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }

    const currentTrainerId = currentSlotCheck.rows[0].trainer_id;
    const currentStartTime = currentSlotCheck.rows[0].start_time;
    const currentSlotDate = currentSlotCheck.rows[0].slot_date;

    // Determine the values that will be used after update
    const newTrainerId = trainer_id !== undefined ? (trainer_id || null) : currentTrainerId;
    const newStartTime = start_time !== undefined ? (start_time instanceof Date ? start_time.toISOString() : start_time) : currentStartTime;
    const newSlotDate = finalSlotDate !== undefined ? finalSlotDate : currentSlotDate;

    // Only check for duplicates if time or trainer is changing
    if (start_time !== undefined || trainer_id !== undefined || finalSlotDate !== undefined) {
      // Check if the new values would create a duplicate
      if (newTrainerId === null) {
        // Check for duplicate unassigned slot
        const duplicateCheck = await db.query(`
          SELECT id FROM slots 
          WHERE slot_date = $1 
            AND start_time = $2 
            AND trainer_id IS NULL 
            AND id != $3
        `, [newSlotDate, newStartTime, req.params.id]);
        
        if (duplicateCheck.rows.length > 0) {
          const error = new Error('A slot with the same date and time already exists (unassigned)');
          error.status = 400;
          error.errorCode = 'DUPLICATE_SLOT';
          return next(error);
        }
      } else {
        // Check for duplicate assigned slot
        const duplicateCheck = await db.query(`
          SELECT id FROM slots 
          WHERE slot_date = $1 
            AND start_time = $2 
            AND trainer_id = $3 
            AND id != $4
        `, [newSlotDate, newStartTime, newTrainerId, req.params.id]);
        
        if (duplicateCheck.rows.length > 0) {
          const error = new Error('A slot with the same date, time, and trainer already exists');
          error.status = 400;
          error.errorCode = 'DUPLICATE_SLOT';
          return next(error);
        }
      }
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
      WHERE s.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }

    const updated = result.rows[0];
    
    // Log audit trail
    await auditService.logSlotUpdate(req.user.id, req.params.id, beforeData, updated);
    
    res.json(updated);
    events.broadcast('slot.updated', updated);
  } catch (error) {
    next(error);
  }
});

// Delete slot (admin only)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    // Get slot data before deletion for audit
    const beforeResult = await db.query('SELECT * FROM slots WHERE id = $1', [req.params.id]);
    if (beforeResult.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }
    const slotData = beforeResult.rows[0];

    const result = await db.query('DELETE FROM slots WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      const error = new Error('Slot not found');
      error.status = 404;
      error.errorCode = 'SLOT_NOT_FOUND';
      return next(error);
    }

    // Log audit trail
    await auditService.logSlotDelete(req.user.id, slotData);

    res.json({ message: 'Slot deleted successfully' });
    events.broadcast('slot.deleted', { id: req.params.id });
  } catch (error) {
    next(error);
  }
});

// Delete slots by date (admin only)
router.delete('/date/:date', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { date } = req.params;
    await db.query(`
      DELETE FROM slots 
      WHERE slot_date = $1::date OR start_time::date = $1::date
    `, [date]);

    res.json({ message: 'Slots deleted successfully' });
    events.broadcast('slot.bulk_deleted', { date });
  } catch (error) {
    next(error);
  }
});

// Generate daily slots (admin only) - Auto-generates if missing
router.post('/generate', authenticate, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { date, force } = req.body;
    // Use the provided date string directly (first 10 chars) to avoid timezone shifts
    const dateString = normalizeDate(date || getToday());

    // Do not generate for today or the past (one-day-at-a-time admin workflow; use tomorrow+)
    const todayStr = getToday();
    if (dateString <= todayStr) {
      client.release();
      const nextDay = addDays(todayStr, 1);
      const error = new Error(
        `Slot generation is only allowed for future dates. Use tomorrow (${nextDay}) or later.`
      );
      error.status = 400;
      error.errorCode = 'GENERATE_FUTURE_DATE_REQUIRED';
      error.suggestedDate = nextDay;
      error.requestedDate = dateString;
      return next(error);
    }

    // PHASE 2: Wrap slot generation in transaction
    await client.query('BEGIN');
    
    // Check if slots already exist for this date
    const existingSlotsCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM slots 
      WHERE slot_date = $1::date AND trainer_id IS NULL
    `, [dateString]);
    
    const existingCount = parseInt(existingSlotsCheck.rows[0]?.count || 0);
    
    // If slots exist and force is not true, suggest next available date
    if (existingCount > 0 && !force) {
      await client.query('ROLLBACK');
      client.release();
      
      // Find next available date
      let nextDate = addDays(dateString, 1);
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const checkResult = await db.query(
          `SELECT COUNT(*) as count FROM slots WHERE slot_date = $1::date AND trainer_id IS NULL`,
          [nextDate]
        );
        
        if (parseInt(checkResult.rows[0]?.count || 0) === 0) {
          const error = new Error(`Slots already exist for ${dateString}. Next available date: ${nextDate}`);
          error.status = 409;
          error.errorCode = 'SLOTS_ALREADY_EXIST';
          error.nextAvailableDate = nextDate;
          error.existingDate = dateString;
          return next(error);
        }
        
        nextDate = addDays(nextDate, 1);
        attempts++;
      }
      
      const error = new Error(`Slots already exist for ${dateString}. No available date found within 30 days.`);
      error.status = 409;
      error.errorCode = 'SLOTS_ALREADY_EXIST';
      error.existingDate = dateString;
      return next(error);
    }
    
    const targetDate = new Date(dateString + 'T00:00:00');

    // Get active vehicles for capacity assignment
    const vehicles = await vehicleService.getActiveVehicles();
    if (vehicles.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      const error = new Error('No active vehicles found. Please create vehicles first.');
      error.status = 400;
      error.errorCode = 'NO_VEHICLES';
      return next(error);
    }

    // PHASE 3: Generate slots based on day of week using utility
    const slots = [];
    const dayOfWeek = getDayOfWeek(dateString); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    // PHASE 5: Extract date components explicitly to avoid undefined variable errors
    // Fix LB-002: Explicitly extract year, month, day from dateString
    // CRITICAL: Extract date components once and reuse to prevent date mutation bugs
    const [year, month, day] = dateString.split('-').map(Number);
    
    // Map day of week to readable name
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];
    
    // PHASE 3: Log slot generation attempt with clear date and day information
    console.log(`[Slot Generation] Admin ${req.user.id} generating slots for ${dateString} (${dayName}, Day of Week: ${dayOfWeek})`);
    
    // Helper function to convert IST time (hours, minutes) to UTC time
    // IST is UTC+5:30, so subtract 5:30 from IST time to get UTC time
    // Example: 7:00 IST = 1:30 UTC (7:00 - 5:30 = 1:30)
    // This function is used for all slot generation to ensure times are stored correctly in UTC
    // PostgreSQL will display them in server timezone (IST) when queried
    const convertISTToUTC = (hoursIST, minutesIST) => {
      let hoursUTC = hoursIST - 5; // Subtract 5 hours
      let minutesUTC = minutesIST - 30; // Subtract 30 minutes
      
      // Handle minute underflow
      if (minutesUTC < 0) {
        minutesUTC += 60;
        hoursUTC -= 1;
      }
      
      // Handle hour underflow (shouldn't happen for valid IST times, but safety check)
      if (hoursUTC < 0) {
        hoursUTC += 24;
      }
      
      return { hours: hoursUTC, minutes: minutesUTC };
    };
    
    // PHASE 3: Monday-Saturday: configured hours with configured interval (7 AM - 9 PM)
    // Business Rules:
    // - Start: 07:00, End: 21:00
    // - Slot duration: 30 minutes
    // - Last slot must be exactly 20:30-21:00 (no slots exceed 21:00)
    // 
    // CRITICAL: Use minute-based calculations to prevent date arithmetic issues
    // Why minute-based logic?
    // - Date.setMinutes() and Date arithmetic can cause problems when crossing day boundaries
    // - Converting to minutes-from-midnight ensures no AM/PM rollover or midnight crossing issues
    // - Pure arithmetic on minutes (0-1440) is safer than Date object manipulation
    // - This guarantees slots stay within the same day (07:00-21:00) and never cross midnight
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      const weekdayConfig = config.slot.generation.weekday;
      
      // PHASE 3: Validate timing (must be 7 AM - 9 PM)
      if (weekdayConfig.startHour !== 7 || weekdayConfig.endHour !== 21) {
        await client.query('ROLLBACK');
        client.release();
        const error = new Error('Invalid weekday slot timing. Must be 7:00 AM - 9:00 PM');
        error.status = 400;
        error.errorCode = 'INVALID_SLOT_TIMING';
        return next(error);
      }
      
      // Convert times to minutes from midnight to avoid date arithmetic issues
      // This is the key to preventing midnight crossing and AM/PM rollover bugs
      // Start: 07:00 = 7 * 60 = 420 minutes from midnight
      // End: 21:00 = 21 * 60 = 1260 minutes from midnight
      // Interval: 30 minutes per slot
      const startMinutes = weekdayConfig.startHour * 60; // 420 minutes (07:00)
      const endMinutes = weekdayConfig.endHour * 60; // 1260 minutes (21:00)
      const intervalMinutes = weekdayConfig.intervalMinutes; // 30 minutes
      
      // Generate slots using minute-based loop (NO Date.setMinutes or Date arithmetic)
      // Loop condition: currentStartMinutes + intervalMinutes <= endMinutes
      // This ensures:
      // - No slot exceeds 21:00 (endMinutes = 1260)
      // - Last slot is exactly 20:30-21:00 (1230-1260 minutes)
      // - Exactly 28 slots: 07:00-07:30, 07:30-08:00, ..., 20:30-21:00
      // - No slots cross midnight (all times are between 420-1260 minutes = 07:00-21:00)
      let currentStartMinutes = startMinutes;
      
      while (currentStartMinutes + intervalMinutes <= endMinutes) {
        // Calculate slot boundaries in minutes (pure arithmetic, no Date manipulation)
        const slotStartMinutes = currentStartMinutes;
        const slotEndMinutes = currentStartMinutes + intervalMinutes;
        
        // Convert minutes back to hours and minutes for Date object creation
        // Extract hours and minutes from total minutes using integer division
        const startHoursIST = Math.floor(slotStartMinutes / 60);
        const startMinsIST = slotStartMinutes % 60;
        const endHoursIST = Math.floor(slotEndMinutes / 60);
        const endMinsIST = slotEndMinutes % 60;
        
        // Convert IST time to UTC time (IST = UTC+5:30)
        const startUTC = convertISTToUTC(startHoursIST, startMinsIST);
        const endUTC = convertISTToUTC(endHoursIST, endMinsIST);
        
        // Create Date objects using Date.UTC to store times in UTC
        // This ensures PostgreSQL stores them correctly and displays them in server timezone (IST)
        const slotStart = new Date(Date.UTC(year, month - 1, day, startUTC.hours, startUTC.minutes, 0, 0));
        const slotEnd = new Date(Date.UTC(year, month - 1, day, endUTC.hours, endUTC.minutes, 0, 0));
        
        // Safety check: ensure slot end doesn't exceed end time
        // This should never trigger with correct minute-based logic, but provides extra safety
        if (slotEndMinutes > endMinutes) {
          break; // Stop if slot would exceed end time
        }
        
        // Increment for next iteration (pure arithmetic on minutes)
        currentStartMinutes += intervalMinutes;

        // PHASE 5: Fix MBR-001 - Slot open rule clarification
        // Slot becomes visible when current_time >= slot_start_time - 24 hours
        // Deterministic check: slot is visible if slot_start_time <= current_time + 24 hours
        const now = new Date();
        const visibilityThreshold = new Date(now.getTime() + SLOT_VISIBILITY_HOURS * 60 * 60 * 1000);
        const isVisible = slotStart > now && slotStart <= visibilityThreshold;

        const slot = {
          trainer_id: null,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          capacity: SLOT_CAPACITY.DEFAULT,
          booked_count: 0,
          status: config.slot.defaultStatus,
          slot_date: dateString,
          is_auto_generated: true,
          is_visible: isVisible
        };

        slots.push(slot);
      }
      
      // Verify we generated exactly 28 slots (07:00-21:00 in 30-minute intervals)
      // Expected: (1260 - 420) / 30 = 28 slots
      const expectedSlots = (endMinutes - startMinutes) / intervalMinutes;
      if (slots.length !== expectedSlots) {
        console.warn(`[Slot Generation] Warning: Generated ${slots.length} slots, expected ${expectedSlots} for ${dateString}`);
      }
      console.log(`[Slot Generation] Generated ${slots.length} weekday slots for ${dateString} (${dayName}) - Expected: ${expectedSlots} slots`);
    }
    // PHASE 3: Sunday: Exact times only (10:30 AM - 12:30 PM & 3:00 PM - 8:00 PM)
    // Business Rules:
    // Morning: 10:30-12:30 (30-minute intervals, last slot: 12:00-12:30)
    // Evening: 15:00-20:00 (30-minute intervals, last slot: 19:30-20:00)
    // NO slots exceed the end times
    else if (dayOfWeek === 0) {
      const sundayConfig = config.slot.generation.sunday;
      
      // PHASE 3: Validate Sunday timing
      const morningStart = sundayConfig.morning[0];
      const morningEnd = sundayConfig.morning[sundayConfig.morning.length - 1];
      if (morningStart.hour !== 10 || morningStart.minute !== 30 || 
          morningEnd.hour !== 12 || morningEnd.minute !== 30) {
        await client.query('ROLLBACK');
        client.release();
        const error = new Error('Invalid Sunday morning slot timing. Must be 10:30 AM - 12:30 PM');
        error.status = 400;
        error.errorCode = 'INVALID_SLOT_TIMING';
        return next(error);
      }
      
      if (sundayConfig.evening.startHour !== 15 || sundayConfig.evening.endHour !== 20) {
        await client.query('ROLLBACK');
        client.release();
        const error = new Error('Invalid Sunday evening slot timing. Must be 3:00 PM - 8:00 PM');
        error.status = 400;
        error.errorCode = 'INVALID_SLOT_TIMING';
        return next(error);
      }
      
      // Morning slots (10:30 AM - 12:30 PM) - 30-minute intervals
      // Generate slots from morning array: each slot is 30 minutes long
      // CRITICAL: Use minute-based calculations to prevent date arithmetic issues
      // Why minute-based logic? Same reason as weekday slots - prevents midnight crossing
      // Convert end time to minutes: 12:30 = 750 minutes from midnight
      const morningEndMinutes = 12 * 60 + 30; // 750 minutes (12:30)
      const morningSlotInterval = 30; // 30 minutes for morning slots
      
      for (const time of sundayConfig.morning) {
        // Convert time to minutes from midnight for calculation (NO Date.setMinutes)
        // Pure arithmetic: time.hour * 60 + time.minute
        const startMinutes = time.hour * 60 + time.minute; // e.g., 10:30 = 630 minutes
        const endMinutes = startMinutes + morningSlotInterval; // e.g., 11:00 = 660 minutes
        
        // Ensure slot doesn't exceed morning end time (12:30) using minute-based check
        if (endMinutes > morningEndMinutes) {
          break; // Stop if slot would exceed end time
        }
        
        // Convert minutes back to hours and minutes for Date object creation
        // Extract hours and minutes from total minutes using integer division
        const startHours = Math.floor(startMinutes / 60);
        const startMins = startMinutes % 60;
        const endHoursIST = Math.floor(endMinutes / 60);
        const endMinsIST = endMinutes % 60;

        const startUTC = convertISTToUTC(startHours, startMins);
        const endUTC = convertISTToUTC(endHoursIST, endMinsIST);
        const slotStart = new Date(Date.UTC(year, month - 1, day, startUTC.hours, startUTC.minutes, 0, 0));
        const slotEnd = new Date(Date.UTC(year, month - 1, day, endUTC.hours, endUTC.minutes, 0, 0));

        const now = new Date();
        const visibilityThreshold = new Date(now.getTime() + SLOT_VISIBILITY_HOURS * 60 * 60 * 1000);
        const isVisible = slotStart > now && slotStart <= visibilityThreshold;

        const slot = {
          trainer_id: null,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          capacity: SLOT_CAPACITY.DEFAULT,
          booked_count: 0,
          status: config.slot.defaultStatus,
          slot_date: dateString,
          is_auto_generated: true,
          is_visible: isVisible
        };

        slots.push(slot);
      }
      
      // Evening slots (15:00 - 20:00) - 30-minute intervals
      // Last slot must be exactly 19:30-20:00 (no slots exceed 20:00)
      // CRITICAL: Use minute-based calculations to prevent date arithmetic issues
      // Why minute-based logic? Same reason as weekday slots - prevents midnight crossing
      // Convert times to minutes from midnight: 15:00 = 900 minutes, 20:00 = 1200 minutes
      const eveningStartMinutes = sundayConfig.evening.startHour * 60; // 900 minutes (15:00)
      const eveningEndMinutes = sundayConfig.evening.endHour * 60; // 1200 minutes (20:00)
      const eveningIntervalMinutes = sundayConfig.evening.intervalMinutes; // 30 minutes
      
      // Generate slots using minute-based loop (NO Date.setMinutes or Date arithmetic)
      // Loop condition: currentEveningStartMinutes + eveningIntervalMinutes <= eveningEndMinutes
      // This ensures:
      // - No slot exceeds 20:00 (eveningEndMinutes = 1200)
      // - Last slot is exactly 19:30-20:00 (1170-1200 minutes)
      // - Exactly 10 slots: 15:00-15:30, 15:30-16:00, ..., 19:30-20:00
      // - No slots cross midnight (all times are between 900-1200 minutes = 15:00-20:00)
      let currentEveningStartMinutes = eveningStartMinutes;
      
      while (currentEveningStartMinutes + eveningIntervalMinutes <= eveningEndMinutes) {
        // Calculate slot boundaries in minutes (pure arithmetic, no Date manipulation)
        const slotStartMinutes = currentEveningStartMinutes;
        const slotEndMinutes = currentEveningStartMinutes + eveningIntervalMinutes;
        
        // Convert minutes back to hours and minutes for Date object creation
        // Extract hours and minutes from total minutes using integer division
        const startHoursIST = Math.floor(slotStartMinutes / 60);
        const startMinsIST = slotStartMinutes % 60;
        const endHoursIST = Math.floor(slotEndMinutes / 60);
        const endMinsIST = slotEndMinutes % 60;
        
        // Convert IST time to UTC time (IST = UTC+5:30)
        const startUTC = convertISTToUTC(startHoursIST, startMinsIST);
        const endUTC = convertISTToUTC(endHoursIST, endMinsIST);
        
        // Create Date objects using Date.UTC to store times in UTC
        // This ensures PostgreSQL stores them correctly and displays them in server timezone (IST)
        const slotStart = new Date(Date.UTC(year, month - 1, day, startUTC.hours, startUTC.minutes, 0, 0));
        const slotEnd = new Date(Date.UTC(year, month - 1, day, endUTC.hours, endUTC.minutes, 0, 0));
        
        // Safety check: ensure slot end doesn't exceed end time
        // This should never trigger with correct minute-based logic, but provides extra safety
        if (slotEndMinutes > eveningEndMinutes) {
          break; // Stop if slot would exceed end time
        }
        
        // Increment for next iteration (pure arithmetic on minutes)
        currentEveningStartMinutes += eveningIntervalMinutes;

        // PHASE 5: Fix MBR-001 - Slot open rule clarification
        // Slot becomes visible when current_time >= slot_start_time - 24 hours
        // Deterministic check: slot is visible if slot_start_time <= current_time + 24 hours
        const now = new Date();
        const visibilityThreshold = new Date(now.getTime() + SLOT_VISIBILITY_HOURS * 60 * 60 * 1000);
        const isVisible = slotStart > now && slotStart <= visibilityThreshold;

        const slot = {
          trainer_id: null,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          capacity: SLOT_CAPACITY.DEFAULT,
          booked_count: 0,
          status: config.slot.defaultStatus,
          slot_date: dateString,
          is_auto_generated: true,
          is_visible: isVisible
        };

        slots.push(slot);
      }
      
      console.log(`[Slot Generation] Generated ${slots.length} Sunday slots for ${dateString} (Morning: ${sundayConfig.morning.length}, Evening: ${slots.length - sundayConfig.morning.length})`);
    }

    // PHASE 2: Insert slots within transaction
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const slot of slots) {
      try {
        // Check if slot exists first (using transaction client)
        const existing = await client.query(`
          SELECT id, capacity FROM slots 
          WHERE slot_date = $1 
            AND start_time = $2 
            AND trainer_id IS NULL
        `, [slot.slot_date, slot.start_time]);
        
        if (existing.rows.length > 0) {
          // Update existing slot
          await client.query(`
            UPDATE slots 
            SET capacity = ${SLOT_CAPACITY.DEFAULT}, 
                is_visible = $1,
                updated_at = NOW()
            WHERE id = $2
          `, [slot.is_visible, existing.rows[0].id]);
          
          // Ensure vehicle capacities exist for this slot
          try {
            const tableCheck = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'slot_vehicle_capacity'
              ) as exists
            `);
            
            if (tableCheck.rows[0]?.exists) {
              await client.query('SELECT ensure_slot_vehicle_capacities($1)', [existing.rows[0].id]);
            }
          } catch (funcError) {
            // Function might not exist, skip
            if (!funcError.message.includes('does not exist')) {
              console.warn(`Failed to ensure capacities for slot ${existing.rows[0].id}:`, funcError.message);
            }
          }
          updatedCount++;
        } else {
          // Insert new slot (without vehicle capacity columns)
          const insertResult = await client.query(`
            INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status, slot_date, is_auto_generated, is_visible)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `, [
            slot.trainer_id, 
            slot.start_time, 
            slot.end_time, 
            slot.capacity, 
            slot.booked_count, 
            slot.status, 
            slot.slot_date, 
            slot.is_auto_generated, 
            slot.is_visible
          ]);
          
          const slotId = insertResult.rows[0].id;
          
          // Insert vehicle capacities for this slot
          // Check if slot_vehicle_capacity table exists before inserting
          try {
            const tableCheck = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'slot_vehicle_capacity'
              ) as exists
            `);
            
            if (tableCheck.rows[0]?.exists) {
              for (const vehicle of vehicles) {
                await client.query(`
                  INSERT INTO slot_vehicle_capacity (slot_id, vehicle_id, capacity)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (slot_id, vehicle_id) DO UPDATE SET capacity = EXCLUDED.capacity
                `, [slotId, vehicle.id, vehicle.max_per_slot]);
              }
              
              // Ensure all vehicles have capacity entries
              await client.query('SELECT ensure_slot_vehicle_capacities($1)', [slotId]);
            } else {
              console.warn(`slot_vehicle_capacity table does not exist. Skipping vehicle capacity insertion for slot ${slotId}.`);
            }
          } catch (capacityError) {
            // If table doesn't exist or function doesn't exist, log warning but continue
            if (capacityError.code === '42P01' || capacityError.message.includes('does not exist')) {
              console.warn(`Could not insert vehicle capacities for slot ${slotId}:`, capacityError.message);
            } else {
              throw capacityError;
            }
          }
          
          insertedCount++;
        }
      } catch (error) {
        // If it's a duplicate key error, skip it
        if (error.code === '23505' || error.message.includes('duplicate key')) {
          skippedCount++;
          continue;
        }
        throw error;
      }
    }

    // Ensure all slots for this date have vehicle capacity entries
    const slotsToUpdate = await client.query(`
      SELECT id FROM slots 
      WHERE slot_date = $1 AND trainer_id IS NULL
    `, [dateString]);
    
    for (const slotRow of slotsToUpdate.rows) {
      await client.query('SELECT ensure_slot_vehicle_capacities($1)', [slotRow.id]);
    }
    
    // Update total capacity for slots - always set to 5 to satisfy constraint
    // Vehicle capacities are tracked separately in slot_vehicle_capacity table
    await client.query(`
      UPDATE slots s
      SET capacity = ${SLOT_CAPACITY.DEFAULT},
      updated_at = NOW()
      WHERE slot_date = $1 
        AND trainer_id IS NULL
        AND booked_count <= ${SLOT_CAPACITY.MAX}
    `, [dateString]);

    // PHASE 2: Commit transaction
    await client.query('COMMIT');

    // PHASE 3: Log successful generation with detailed summary
    // Reuse dayName variable that was already calculated earlier in the function
    console.log(`[Slot Generation] Success for ${dateString} (${dayName}): ${slots.length} total slots generated (${insertedCount} inserted, ${updatedCount} updated, ${skippedCount} skipped)`);
    
    const payload = {
      success: true,
      status: 'GENERATED',
      message: `Processed ${slots.length} slots for ${dateString}: ${insertedCount} inserted, ${updatedCount} updated, ${skippedCount} skipped`,
      slotsCreated: insertedCount,
      slotsUpdated: updatedCount,
      slotsSkipped: skippedCount,
      totalProcessed: slots.length,
      date: dateString,
      adminId: req.user.id
    };
    res.json(payload);
    events.broadcast('slot.generated', payload);
  } catch (error) {
    // PHASE 2: Rollback transaction on error
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// PHASE 3: Get next available date without slots (admin helper API)
router.get('/next-available-date', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { start_date } = req.query;
    const startDate = normalizeDate(start_date || getToday());
    
    // Check up to 30 days ahead
    let checkDate = addDays(startDate, 1);
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM slots WHERE slot_date = $1 AND trainer_id IS NULL`,
        [checkDate]
      );
      
      if (parseInt(result.rows[0]?.count || 0) === 0) {
        return res.json({
          success: true,
          nextAvailableDate: checkDate,
          startDate: startDate,
          daysAhead: attempts + 1
        });
      }
      
      checkDate = addDays(checkDate, 1);
      attempts++;
    }
    
    // No available date found
    res.json({
      success: false,
      nextAvailableDate: null,
      startDate: startDate,
      message: 'No available date found within 30 days'
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

// Update slot visibility for all slots (admin only, can be called periodically)
router.post('/update-visibility', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    // Check if update_all_slots_visibility function exists
    const hasFunction = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_all_slots_visibility'
      ) as exists
    `).then(r => r.rows[0].exists);

    if (hasFunction) {
      const result = await db.query('SELECT update_all_slots_visibility() as updated_count');
      const updatedCount = result.rows[0].updated_count || 0;
      res.json({
        success: true,
        message: `Updated visibility for ${updatedCount} slots`,
        updated_count: updatedCount
      });
    } else {
      // Booking window: visible when slot is in the future and within SLOT_VISIBILITY_HOURS
      const result = await db.query(`
        UPDATE slots
        SET is_visible = (
          start_time > NOW()
          AND start_time <= (NOW() + INTERVAL '${SLOT_VISIBILITY_HOURS} hours')
        )
        WHERE is_visible IS DISTINCT FROM (
          start_time > NOW()
          AND start_time <= (NOW() + INTERVAL '${SLOT_VISIBILITY_HOURS} hours')
        )
      `);
      res.json({
        success: true,
        message: `Updated visibility for slots`,
        updated_count: result.rowCount || 0
      });
    }
  } catch (error) {
    next(error);
  }
});

// Auto-generate slots for today if missing (public endpoint, can be called by cron)
router.post('/ensure-daily', async (req, res, next) => {
  try {
    const { date } = req.body;
    const dateString = (date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const targetDate = new Date(dateString + 'T00:00:00');

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
        // Generate slots (9 AM to 9 PM, 30-minute intervals)
        const generateResult = await db.query(`
          INSERT INTO slots (trainer_id, start_time, end_time, slot_date, capacity, booked_count, status, is_auto_generated)
          SELECT 
            NULL,
            generate_series(
              $1::date + INTERVAL '${config.slot.generation.legacy.startHour} hours',
              $1::date + INTERVAL '${config.slot.generation.legacy.endHour} hours',
              INTERVAL '${config.slot.generation.legacy.intervalMinutes} minutes'
            )::timestamptz as start_time,
            generate_series(
              $1::date + INTERVAL '${config.slot.generation.legacy.startHour} hours ${config.slot.generation.legacy.intervalMinutes} minutes',
              $1::date + INTERVAL '${config.slot.generation.legacy.endHour} hours ${config.slot.generation.legacy.intervalMinutes} minutes',
              INTERVAL '${config.slot.generation.legacy.intervalMinutes} minutes'
            )::timestamptz as end_time,
            $1::date,
            ${config.slot.defaultCapacity}, 0, '${config.slot.defaultStatus}', true
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
