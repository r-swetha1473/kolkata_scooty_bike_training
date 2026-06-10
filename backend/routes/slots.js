const express = require('express');
const db = require('../db');
const { adminAccess } = require('../middleware/adminAccess');
const { validateSlotCreation, validateSlotUpdate } = require('../validators');
const config = require('../app.config');
const { SLOT_CAPACITY, CANCELLATION_WINDOW_HOURS, SLOT_VISIBILITY_HOURS } = require('../config/app.config');
const vehicleService = require('../services/vehicle.service');
const auditService = require('../services/audit.service');
const router = express.Router();
const events = require('../events');
const { normalizeDate, addDays, getDayOfWeek, getToday } = require('../utils/dateUtils');
const { sqlBookableSlotConditions } = require('../utils/slotBookableSql');
const slotGenerationService = require('../services/slotGeneration.service');

let autoGenerationInFlight = null;

async function ensureAutoSlotsIfNeeded(baseQuery, params, mode = 'list') {
  const result = await db.query(baseQuery, params);
  if (result.rows.length > 0) {
    return result;
  }

  // Fallback for production/serverless deployments where cron may not run.
  if (process.env.ENABLE_LIVE_AUTO_SLOT_FALLBACK === '0') {
    return result;
  }

  try {
    if (!autoGenerationInFlight) {
      autoGenerationInFlight = slotGenerationService
        .runNightlyAutoGeneration()
        .catch((err) => {
          console.error(`[slot auto fallback:${mode}]`, err.message);
        })
        .finally(() => {
          autoGenerationInFlight = null;
        });
    }
    await autoGenerationInFlight;
  } catch (err) {
    console.error(`[slot auto fallback:${mode}]`, err.message);
  }

  return db.query(baseQuery, params);
}

async function ensureAutoSlotsForDateIfNeeded(baseQuery, params, dateString, mode = 'date') {
  const result = await db.query(baseQuery, params);
  if (result.rows.length > 0) {
    return result;
  }

  if (process.env.ENABLE_LIVE_AUTO_SLOT_FALLBACK === '0') {
    return result;
  }

  try {
    const normalized = normalizeDate(dateString);
    if (normalized < getToday()) {
      return result;
    }
    await slotGenerationService.generateSlotsForDate(normalized, { mode: 'auto', force: false });
  } catch (err) {
    console.error(`[slot auto fallback:${mode}]`, err.message);
  }

  return db.query(baseQuery, params);
}

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

    const shouldAttemptAutoFallback =
      !trainer_id && !date && !start_date && !end_date && available_only !== 'false' && status !== 'disabled';

    const result = shouldAttemptAutoFallback
      ? await ensureAutoSlotsIfNeeded(query, params, 'root')
      : await db.query(query, params);

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
    const dateQuery = `
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
      ${req.query.bookable_only === 'true' || req.query.bookable_only === '1' ? `AND (${sqlBookableSlotConditions('s', { dateScoped: true })})` : ''}
      GROUP BY s.id, s.trainer_id, s.start_time, s.end_time, s.slot_date, s.capacity, s.booked_count,
               s.status, s.is_auto_generated, s.is_visible, s.created_at, s.updated_at,
               t.id, t.user_id, t.is_active, p.full_name
      ORDER BY s.start_time ASC
    `;

    const result = await ensureAutoSlotsForDateIfNeeded(dateQuery, [date], date, 'date');

    if (
      process.env.NODE_ENV !== 'production' &&
      (req.query.bookable_only === 'true' || req.query.bookable_only === '1')
    ) {
      console.log('[Slots Debug] GET /date/:date bookable_only', {
        requestedDate: date,
        slotsReturned: result.rows.length,
        sample: result.rows.slice(0, 3).map((s) => ({
          id: s.id,
          start_time: s.start_time,
          booked_count: s.booked_count,
          capacity: s.capacity,
          trainer_id: s.trainer_id,
          status: s.status
        }))
      });
    }

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

// Get available slots — same predicate as GET /date/:date?bookable_only=true (full payload + vehicle_capacities)
router.get('/available', async (req, res, next) => {
  try {
    const { date } = req.query;
    const params = [];
    let dateFilter = '';
    if (date) {
      params.push(date);
      dateFilter = `AND (s.slot_date = $${params.length}::date OR s.start_time::date = $${params.length}::date)`;
    }

    const availableQuery = `
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
      WHERE (${sqlBookableSlotConditions('s')})
      ${dateFilter}
      GROUP BY s.id, s.trainer_id, s.start_time, s.end_time, s.slot_date, s.capacity, s.booked_count,
               s.status, s.is_auto_generated, s.is_visible, s.created_at, s.updated_at,
               t.id, t.user_id, t.is_active, p.full_name
      ORDER BY s.start_time ASC
    `;

    const result = date
      ? await ensureAutoSlotsForDateIfNeeded(availableQuery, params, date, 'available-date')
      : await ensureAutoSlotsIfNeeded(availableQuery, params, 'available');

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Update vehicle capacity for a slot (admin only)
router.put('/:id/vehicle-capacity', ...adminAccess('slots', 'edit'), async (req, res, next) => {
  const client = await db.getClient();
  
  try {
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
router.post('/', ...adminAccess('slots', 'create'), validateSlotCreation, async (req, res, next) => {
  try {
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
router.put('/:id/trainer', ...adminAccess('slots', 'edit'), async (req, res, next) => {
  try {
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
router.put('/:id/status', ...adminAccess('slots', 'edit'), async (req, res, next) => {
  try {
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
router.put('/:id/toggle', ...adminAccess('slots', 'edit'), async (req, res, next) => {
  try {
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
router.put('/:id', ...adminAccess('slots', 'edit'), validateSlotUpdate, async (req, res, next) => {
  try {
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
router.delete('/:id', ...adminAccess('slots', 'delete'), async (req, res, next) => {
  try {
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
router.delete('/date/:date', ...adminAccess('slots', 'delete'), async (req, res, next) => {
  try {
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

// Generate daily slots (admin only)
router.post('/generate', ...adminAccess('slots', 'create'), async (req, res, next) => {
  try {
    const { date, force } = req.body;
    const dateString = normalizeDate(date || getToday());
    const payload = await slotGenerationService.generateSlotsForDate(dateString, {
      mode: 'admin',
      force: !!force,
      actorProfileId: req.user.id
    });
    res.json(payload);
  } catch (error) {
    if (error.status == null) error.status = 400;
    next(error);
  }
});

// Generate missing slots for rolling window (admin only)
router.post('/generate-missing', ...adminAccess('slots', 'create'), async (req, res, next) => {
  try {
    const daysRaw = Number(req.body?.days || 7);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 30 ? daysRaw : 7;
    const payload = await slotGenerationService.ensureSlotsOnStartup(days);
    res.json(payload);
  } catch (error) {
    if (error.status == null) error.status = 400;
    next(error);
  }
});

// PHASE 3: Get next available date without slots (admin helper API)
router.get('/next-available-date', ...adminAccess('slots', 'view'), async (req, res, next) => {
  try {
    const { start_date } = req.query;
    const startDate = normalizeDate(start_date || getToday());
    
    // Check up to 30 days ahead
    let checkDate = addDays(startDate, 1);
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM slots WHERE slot_date = $1::date`,
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

// Legacy alias — same as POST /generate
router.post('/generate-daily', ...adminAccess('slots', 'create'), async (req, res, next) => {
  try {
    const { date, force } = req.body;
    const dateString = normalizeDate(date || getToday());
    const payload = await slotGenerationService.generateSlotsForDate(dateString, {
      mode: 'admin',
      force: !!force,
      actorProfileId: req.user.id
    });
    res.json(payload);
  } catch (error) {
    if (error.status == null) error.status = 400;
    next(error);
  }
});

// Update slot visibility for all slots (admin only, can be called periodically)
router.post('/update-visibility', ...adminAccess('slots', 'edit'), async (req, res, next) => {
  try {
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

module.exports = router;
