const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const emailService = require('../services/email.service');
const whatsappService = require('../services/whatsapp.service');
const { validateBookingCreation } = require('../validators');
const config = require('../app.config');
const { 
  SLOT_CAPACITY, 
  CANCELLATION_WINDOW_HOURS, 
  CANCELLATION_DEADLINE_HOURS,
  SLOT_VISIBILITY_HOURS,
  WEEKLY_BOOKING_LIMIT,
  TOTAL_BOOKING_LIMIT,
  ENTITLEMENT_VALIDITY_DAYS
} = require('../config/app.config');
const { validateBookingEligibility, validateCancellationEligibility } = require('../services/bookingValidation.service');
const vehicleService = require('../services/vehicle.service');
const auditService = require('../services/audit.service');
const { normalizeBookingCreateBody } = require('../middleware/bookingPayload');
const { normalizeIndianMobileDigits } = require('../utils/phoneNormalize');
const {
  assignTrainerAndVehicleForSlot,
  assignTrainerForSlot,
  assignVehicleForSlot
} = require('../services/bookingAssignment.service');
const router = express.Router();

/** OAuth profiles use a synthetic phone (GOOGLE_<id>) until the user saves a real number. */
function isPlaceholderProfilePhone(phone) {
  if (phone == null || String(phone).trim() === '') return true;
  return String(phone).startsWith('GOOGLE_');
}

function logPostBookingRequest(req, res, next) {
  const enabled =
    process.env.LOG_BOOKING_DEBUG === '1' || process.env.NODE_ENV === 'development';
  if (!enabled) return next();

  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const u = req.user || {};
  const bodyForLog = {
    slot_id: b.slot_id,
    phone: b.phone
      ? `***${String(b.phone).slice(-4)} (${String(b.phone).length} digits)`
      : b.phone === '' ? '(empty)' : '(omitted)',
    notes: typeof b.notes === 'string' && b.notes.length ? `[${b.notes.length} chars]` : '(empty)'
  };
  console.log('[Bookings][POST] req.user:', {
    id: u.id,
    email: u.email,
    role: u.role,
    phone_registered: u.phone
      ? String(u.phone).startsWith('GOOGLE_')
        ? '(placeholder)'
        : `***${String(u.phone).slice(-4)}`
      : '(none)'
  });
  console.log('[Bookings][POST] req.body (normalized, phone masked):', bodyForLog);
  next();
}

router.post(
  '/',
  authenticate,
  normalizeBookingCreateBody,
  logPostBookingRequest,
  validateBookingCreation,
  async (req, res, next) => {
  const client = await db.getClient();

  try {
    if (!req.user || !req.user.id) {
      const authError = new Error('Unauthorized');
      authError.status = 401;
      authError.errorCode = 'AUTH_USER_MISSING';
      throw authError;
    }

    await client.query('BEGIN');

    // Check if student_recognition table exists (optional feature)
    let studentRecognitionEnabled = false;
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'student_recognition'
        )
      `);
      studentRecognitionEnabled = tableCheck.rows[0]?.exists || false;
    } catch (err) {
      // Table doesn't exist, skip recognition check
      studentRecognitionEnabled = false;
    }

    // Check student recognition status FIRST - must be approved before any booking logic
    // Only if the table exists (optional feature)
    if (studentRecognitionEnabled) {
      try {
        const studentRecognitionCheck = await client.query(
          `SELECT status FROM student_recognition 
           WHERE user_id = $1 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [req.user.id]
        );

        if (studentRecognitionCheck.rows.length === 0) {
          throw new Error('Student recognition not found. Please submit your invoice for verification before making bookings.');
        }

        const recognitionStatus = studentRecognitionCheck.rows[0].status;
        if (recognitionStatus !== 'approved') {
          throw new Error(`Your student recognition status is "${recognitionStatus}". Only approved students can make bookings. Please wait for approval or contact support.`);
        }
      } catch (err) {
        // If it's a table error, ignore (table doesn't exist)
        if (err.message && err.message.includes('does not exist')) {
          // Table doesn't exist, skip this check
        } else {
          // It's a business logic error, re-throw it
          throw err;
        }
      }
    }

    // Check if student_entitlements table exists (optional feature)
    let studentEntitlementsEnabled = false;
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'student_entitlements'
        )
      `);
      studentEntitlementsEnabled = tableCheck.rows[0]?.exists || false;
    } catch (err) {
      // Table doesn't exist, skip entitlements check
      studentEntitlementsEnabled = false;
    }

    // Check student entitlements - must have valid, non-expired entitlements with available slots
    // Only if the table exists (optional feature)
    if (studentEntitlementsEnabled) {
      try {
        const entitlementCheck = await client.query(
          `SELECT total_slots, used_slots, expiry_date 
           FROM student_entitlements 
           WHERE user_id = $1`,
          [req.user.id]
        );

        if (entitlementCheck.rows.length === 0) {
          throw new Error('No entitlements found. Please contact support to set up your booking entitlements.');
        }

        const entitlement = entitlementCheck.rows[0];
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set to start of day for date-only comparison
        const expiryDate = entitlement.expiry_date ? new Date(entitlement.expiry_date) : null;

        // Check if entitlement has expired (current date must be <= expiry_date)
        if (expiryDate) {
          expiryDate.setHours(0, 0, 0, 0); // Set to start of day for date-only comparison
          if (currentDate > expiryDate) {
            throw new Error(`Your booking entitlement has expired on ${expiryDate.toLocaleDateString()}. Please contact support to renew your entitlements.`);
          }
        }

        // Check if all slots have been used
        if (entitlement.used_slots >= entitlement.total_slots) {
          throw new Error(`You have used all your available booking slots (${entitlement.used_slots}/${entitlement.total_slots}). Please contact support to add more slots.`);
        }
      } catch (err) {
        // If it's a table error, ignore (table doesn't exist)
        if (err.message && err.message.includes('does not exist')) {
          // Table doesn't exist, skip this check
        } else {
          // It's a business logic error, re-throw it
          throw err;
        }
      }
    }

    let { slot_id, phone, notes, trainer_id: clientTrainerId, vehicle_id: clientVehicleId } = req.body;

    if (!slot_id) {
      const error = new Error('slot_id is required');
      error.status = 400;
      error.errorCode = 'MISSING_SLOT_ID';
      throw error;
    }

    const userCheck = await client.query(
      'SELECT phone, role, inactive_blocked FROM profiles WHERE id = $1',
      [req.user.id]
    );

    if (userCheck.rows.length === 0) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    const user = userCheck.rows[0];

    if (user.role === 'customer' && user.inactive_blocked === true) {
      const blocked = new Error('Your account is inactive. Contact admin.');
      blocked.status = 403;
      blocked.errorCode = 'INACTIVE_BLOCKED';
      throw blocked;
    }

    const activeBookingRow = await client.query(
      `SELECT b.id
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       WHERE b.user_id = $1
         AND b.status NOT IN ('cancelled', 'completed', 'no_show')
         AND s.end_time > NOW()
       LIMIT 1`,
      [req.user.id]
    );
    if (activeBookingRow.rows.length > 0) {
      const dup = new Error('You already have a booking. Cancel it to book another.');
      dup.status = 400;
      dup.errorCode = 'ACTIVE_BOOKING_EXISTS';
      throw dup;
    }
    
    // PHASE 5: Fix MBR-002 - Enforce phone number must match registered profile phone
    // Business rule: "Booking allowed only for registered phone numbers"
    // If user has no phone registered, require them to provide one (and it will be registered)
    if (isPlaceholderProfilePhone(user.phone) && !phone) {
      const err = new Error('Phone number is required to make bookings. Please provide your mobile number.');
      err.status = 400;
      throw err;
    }
    
    if (phone) {
      if (!config.booking.phoneNumberPattern.test(phone)) {
        const err = new Error(config.booking.phoneNumberErrorMessage);
        err.status = 400;
        throw err;
      }
      
      if (!isPlaceholderProfilePhone(user.phone)) {
        const a = normalizeIndianMobileDigits(phone);
        const b = normalizeIndianMobileDigits(user.phone);
        if (a !== b || !a) {
          const err = new Error(
            'Phone number must match your registered mobile (same 10 digits as on your profile, with or without +91).'
          );
          err.status = 400;
          err.errorCode = 'PHONE_MISMATCH';
          throw err;
        }
      }
      
      if (isPlaceholderProfilePhone(user.phone)) {
        try {
          await client.query(
            'UPDATE profiles SET phone = $1, updated_at = NOW() WHERE id = $2',
            [phone, req.user.id]
          );
          console.log(`[Booking] Registered phone number for user ${req.user.id}: ${phone}`);
        } catch (updateError) {
          // If unique constraint violation, phone already exists for another user
          if (updateError.code === '23505' || updateError.message.includes('unique')) {
            throw new Error('This phone number is already registered to another account. Please use your registered phone number.');
          }
          throw updateError;
        }
      }
    }
    
    // Use registered phone number (either existing or newly set); normalize profile storage (+91, etc.)
    const bookingPhone = phone || normalizeIndianMobileDigits(user.phone) || user.phone;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const chosenTrainerId =
      clientTrainerId && uuidPattern.test(String(clientTrainerId).trim())
        ? String(clientTrainerId).trim()
        : null;

    let trainer_id;
    let vehicle_id;

    const chosenVehicleId =
      clientVehicleId && uuidPattern.test(String(clientVehicleId).trim())
        ? String(clientVehicleId).trim()
        : null;

    if (chosenVehicleId) {
      const vehicleRow = await client.query(
        `SELECT id FROM vehicles WHERE id = $1 AND is_active = true`,
        [chosenVehicleId]
      );
      if (vehicleRow.rows.length === 0) {
        const err = new Error('Selected vehicle is not available.');
        err.status = 400;
        err.errorCode = 'VEHICLE_INACTIVE';
        throw err;
      }
      const earlyVehicleCheck = await vehicleService.checkVehicleAvailability(
        slot_id,
        chosenVehicleId
      );
      if (!earlyVehicleCheck.available) {
        const err = new Error(
          'This vehicle type is fully booked for the selected time slot. Please choose another vehicle or slot.'
        );
        err.status = 409;
        err.errorCode = 'VEHICLE_CAPACITY_FULL';
        throw err;
      }
      vehicle_id = chosenVehicleId;
    }

    if (chosenTrainerId) {
      const trainerRow = await client.query(
        `SELECT id FROM trainers WHERE id = $1 AND is_active = true`,
        [chosenTrainerId]
      );
      if (trainerRow.rows.length === 0) {
        const err = new Error('Selected trainer is not available.');
        err.status = 400;
        err.errorCode = 'TRAINER_INACTIVE';
        throw err;
      }
      const taken = await client.query(
        `SELECT 1 FROM bookings b
         WHERE b.slot_id = $1 AND b.trainer_id = $2 AND b.status NOT IN ('cancelled')
         LIMIT 1`,
        [slot_id, chosenTrainerId]
      );
      if (taken.rows.length > 0) {
        const err = new Error(
          'This trainer is already booked for this time slot. Choose another trainer.'
        );
        err.status = 409;
        err.errorCode = 'TRAINER_SLOT_TAKEN';
        throw err;
      }
      trainer_id = chosenTrainerId;
      if (!vehicle_id) {
        const v = await assignVehicleForSlot(client, slot_id);
        if (!v.ok) {
          const assignMessages = {
            NO_VEHICLE_CAPACITY:
              'This time slot is full for all training vehicles. Please choose another slot.'
          };
          const err = new Error(
            assignMessages[v.code] || 'Unable to assign a vehicle for this slot.'
          );
          err.status = 409;
          err.errorCode = v.code || 'ASSIGNMENT_FAILED';
          throw err;
        }
        vehicle_id = v.vehicleId;
      }
    } else {
      if (vehicle_id) {
        const t = await assignTrainerForSlot(client, slot_id);
        if (!t.ok) {
          const assignMessages = {
            SLOT_NOT_FOUND: 'Slot not found',
            NO_TRAINER_AVAILABLE:
              'No trainer is available for this slot. Try another time or contact support.'
          };
          const err = new Error(
            assignMessages[t.code] || 'Unable to assign trainer for this slot.'
          );
          err.status = t.code === 'SLOT_NOT_FOUND' ? 404 : 409;
          err.errorCode = t.code || 'ASSIGNMENT_FAILED';
          throw err;
        }
        trainer_id = t.trainerId;
      } else {
        const assignResult = await assignTrainerAndVehicleForSlot(client, slot_id);
        if (!assignResult.ok) {
          const assignMessages = {
            SLOT_NOT_FOUND: 'Slot not found',
            NO_TRAINER_AVAILABLE:
              'No trainer is available for this slot. Try another time or contact support.',
            NO_VEHICLE_CAPACITY:
              'This time slot is full for all training vehicles. Please choose another slot.'
          };
          const err = new Error(
            assignMessages[assignResult.code] || 'Unable to assign trainer or vehicle for this slot.'
          );
          err.status = assignResult.code === 'SLOT_NOT_FOUND' ? 404 : 409;
          err.errorCode = assignResult.code || 'ASSIGNMENT_FAILED';
          throw err;
        }
        trainer_id = assignResult.trainerId;
        vehicle_id = assignResult.vehicleId;
      }
    }

    const slotCheck = await client.query(
      `SELECT start_time, end_time, slot_date FROM slots WHERE id = $1`,
      [slot_id]
    );

    if (slotCheck.rows.length === 0) {
      const err = new Error('Slot not found');
      err.status = 404;
      throw err;
    }

    const slot = slotCheck.rows[0];
    const slotDate = slot.slot_date || slot.start_time.toISOString().split('T')[0];
    const slotTime = slot.start_time;

    const validationResult = await validateBookingEligibility(
      bookingPhone,
      slotDate,
      slotTime,
      vehicle_id,
      slot_id,
      req.user.id,
      trainer_id
    );

    if (!validationResult.eligible) {
      const err = new Error(validationResult.message || `Booking not eligible: ${validationResult.reason}`);
      err.status = validationResult.reason === 'INACTIVE_BLOCKED' ? 403 : 400;
      err.errorCode = validationResult.reason || validationResult.errorCode || 'BOOKING_NOT_ELIGIBLE';
      throw err;
    }

    // Get vehicle details dynamically
    const vehicle = await vehicleService.getVehicleById(vehicle_id);
    if (!vehicle || !vehicle.is_active) {
      throw new Error('Invalid or inactive vehicle selected');
    }

    // Check vehicle capacity dynamically
    const vehicleAvailability = await vehicleService.checkVehicleAvailability(slot_id, vehicle_id);
    if (!vehicleAvailability.available) {
      throw new Error(`All ${vehicle.name} slots are full for this time slot (${vehicleAvailability.booked}/${vehicleAvailability.capacity} booked)`);
    }

    // Dynamic vehicle-based booking creation
    // PHASE 5: Fix DIR-002 - Harden vehicle capacity with FOR UPDATE NOWAIT to prevent race conditions
    // Lock slot with NOWAIT to fail fast if slot is already locked (prevents deadlocks)
    // Lock is held until transaction commit, ensuring no concurrent bookings can interfere
    // No hardcoded vehicle types - uses vehicle_id and vehicle.max_per_slot dynamically
    const bookingResult = await client.query(
      `WITH locked_slot AS (
        SELECT s.*,
               (SELECT COUNT(*) FROM bookings WHERE slot_id = s.id AND vehicle_id = $3 AND status NOT IN ('cancelled')) as vehicle_booked_count
        FROM slots s
        WHERE s.id = $1
        FOR UPDATE NOWAIT
      ),
      vehicle_check AS (
        SELECT 
          v.max_per_slot,
          v.name,
          COALESCE(
            (SELECT svc.capacity FROM slot_vehicle_capacity svc
             WHERE svc.slot_id = $1 AND svc.vehicle_id = v.id),
            v.max_per_slot
          ) AS vehicle_capacity
        FROM vehicles v
        WHERE v.id = $3 AND v.is_active = true
      ),
      slot_validation AS (
        SELECT 
          ls.*,
          vc.vehicle_capacity,
          vc.name as vehicle_name,
          CASE 
            WHEN ls.id IS NULL THEN 'SLOT_NOT_FOUND'
            WHEN vc.vehicle_capacity IS NULL THEN 'INVALID_VEHICLE'
            WHEN (SELECT id FROM trainers WHERE id = $4) IS NULL THEN 'TRAINER_NOT_FOUND'
            WHEN (SELECT is_active FROM trainers WHERE id = $4) IS NOT TRUE THEN 'TRAINER_INACTIVE'
            WHEN EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.slot_id = $1 AND b.trainer_id = $4 AND b.status NOT IN ('cancelled')
            ) THEN 'TRAINER_SLOT_TAKEN'
            WHEN ls.status IN ('disabled', 'cancelled') THEN 'SLOT_NOT_AVAILABLE'
            WHEN ls.status NOT IN ('available', 'full') THEN 'SLOT_INVALID_STATUS'
            WHEN ls.start_time <= NOW() THEN 'SLOT_PAST'
            WHEN ls.start_time > (NOW() + INTERVAL '${SLOT_VISIBILITY_HOURS} hours') THEN 'BOOKING_NOT_OPEN_YET'
            WHEN ls.vehicle_booked_count >= vc.vehicle_capacity THEN 'VEHICLE_CAPACITY_FULL'
            ELSE 'VALID'
          END as validation_status
        FROM locked_slot ls
        CROSS JOIN vehicle_check vc
      ),
      booking_insert AS (
        INSERT INTO bookings (user_id, slot_id, trainer_id, vehicle_id, phone, status, notes)
        SELECT $2, $1, $4, $3, $5, $6, $7
        FROM slot_validation sv
        WHERE validation_status = 'VALID'
        RETURNING *
      ),
      slot_update AS (
        UPDATE slots
        SET booked_count = booked_count + 1,
            status = CASE 
              WHEN slots.booked_count + 1 >= slots.capacity THEN 'full'
              WHEN slots.booked_count = 0 THEN 'available'
              ELSE slots.status
            END
        FROM booking_insert
        WHERE slots.id = $1
          AND EXISTS (SELECT 1 FROM booking_insert)
        RETURNING slots.*
      )
      SELECT 
        bi.id,
        bi.user_id,
        bi.slot_id,
        bi.trainer_id,
        bi.vehicle_id,
        bi.phone,
        bi.status,
        bi.notes,
        bi.created_at,
        bi.updated_at,
        sv.validation_status
      FROM booking_insert bi
      CROSS JOIN slot_validation sv
      UNION ALL
      SELECT 
        NULL::uuid as id,
        NULL::uuid as user_id,
        NULL::uuid as slot_id,
        NULL::uuid as trainer_id,
        NULL::uuid as vehicle_id,
        NULL::text as phone,
        NULL::text as status,
        NULL::text as notes,
        NULL::timestamptz as created_at,
        NULL::timestamptz as updated_at,
        sv.validation_status
      FROM slot_validation sv
      WHERE NOT EXISTS (SELECT 1 FROM booking_insert)
        AND sv.validation_status != 'VALID'
      LIMIT 1`,
      [slot_id, req.user.id, vehicle_id, trainer_id, bookingPhone, config.booking.defaultStatus, notes]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error('Slot not found');
    }

    const result = bookingResult.rows[0];

    // Check if booking was inserted (validation_status will be 'VALID' if successful)
    if (result.validation_status !== 'VALID' || !result.id) {
      // Map validation status to user-friendly error messages
      const errorMessages = {
        'SLOT_NOT_FOUND': 'Slot not found',
        'SLOT_NOT_AVAILABLE': 'Slot is not available',
        'SLOT_INVALID_STATUS': 'Slot is not available for booking',
        'SLOT_FULL': 'Slot is already fully booked',
        'SLOT_INVALID_CAPACITY': config.slot.maxCapacityErrorMessage,
        'SLOT_NOT_VISIBLE': config.slot.visibilityWindowMessage,
        'SLOT_PAST': 'This slot has already started or passed',
        'BOOKING_NOT_OPEN_YET': config.booking.bookingWindowMessage,
        'TRAINER_NOT_FOUND': 'Selected trainer was not found',
        'TRAINER_INACTIVE': 'This trainer is not available for booking',
        'TRAINER_SLOT_TAKEN': 'This trainer is already booked for this time slot. Choose another trainer.',
        'VEHICLE_CAPACITY_FULL': `All ${vehicle.name} slots are full for this time slot`,
        'INVALID_VEHICLE': 'Invalid or inactive vehicle selected'
      };
      throw new Error(errorMessages[result.validation_status] || 'Unable to create booking');
    }

    // Extract booking data (exclude validation fields)
    // Include vehicle_id and phone in response (no hardcoded vehicle_type)
    const booking = {
      id: result.id,
      user_id: result.user_id,
      slot_id: result.slot_id,
      trainer_id: result.trainer_id,
      vehicle_id: result.vehicle_id,
      phone: result.phone || bookingPhone,
      status: result.status,
      notes: result.notes,
      created_at: result.created_at,
      updated_at: result.updated_at
    };

    try {
      await client.query('SELECT increment_weekly_booking_count($1)', [req.user.id]);
    } catch (err) {
      await client.query(
        `UPDATE profiles
         SET last_booking_date = CURRENT_DATE,
             total_bookings = COALESCE(total_bookings, 0) + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [req.user.id]
      );
    }

    if (studentEntitlementsEnabled) {
      try {
        await client.query(
          `UPDATE student_entitlements
           SET used_slots = COALESCE(used_slots, 0) + 1, updated_at = NOW()
           WHERE user_id = $1`,
          [req.user.id]
        );
      } catch (usedErr) {
        console.warn('[Bookings] student_entitlements used_slots increment:', usedErr.message);
      }
    }

    // Check if this is the first booking and set entitlement dates (only if table exists)
    if (studentEntitlementsEnabled) {
      try {
        const firstBookingCheck = await client.query(
          'SELECT first_booking_date FROM student_entitlements WHERE user_id = $1',
          [req.user.id]
        );

        if (firstBookingCheck.rows.length > 0) {
          const entitlement = firstBookingCheck.rows[0];
          // If first_booking_date is NULL, this is the first booking
          if (!entitlement.first_booking_date) {
            await client.query(
              `UPDATE student_entitlements 
               SET first_booking_date = CURRENT_DATE,
                   expiry_date = CURRENT_DATE + INTERVAL '${ENTITLEMENT_VALIDITY_DAYS} days',
                   updated_at = NOW()
               WHERE user_id = $1`,
              [req.user.id]
            );
          }
        } else {
          // Create entitlement record if it doesn't exist (first booking)
          await client.query(
            `INSERT INTO student_entitlements (user_id, first_booking_date, expiry_date, total_slots, used_slots)
             VALUES ($1, CURRENT_DATE, CURRENT_DATE + INTERVAL '${ENTITLEMENT_VALIDITY_DAYS} days', 0, 0)`,
            [req.user.id]
          );
        }
      } catch (err) {
        // Table doesn't exist or error, skip (optional feature)
        console.warn('student_entitlements table not found, skipping entitlement update');
      }
    }

    await client.query('COMMIT');

    auditService.logBookingCreate(req.user.id, booking).catch((err) => {
      console.error('[Audit] BOOKING_CREATED failed:', err.message);
    });

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
        `, [booking.trainer_id]),
        db.query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id])
      ]);

      if (userResult.rows[0] && slotResult.rows[0] && trainerResult.rows[0] && vehicleResult.rows[0]) {
        const user = userResult.rows[0];
        const slot = slotResult.rows[0];
        const trainer = { full_name: trainerResult.rows[0].full_name };
        const vehicle = vehicleResult.rows[0];

        // Send email notification
        emailService.sendBookingConfirmation(
          booking, user, slot, trainer, vehicle
        ).catch(err => console.error('Email notification failed:', err));

        // Send WhatsApp notification
        if (user.phone) {
          whatsappService.sendBookingConfirmation(
            booking, user, slot, trainer, vehicle
          ).catch(err => console.error('WhatsApp notification failed:', err));

          // Send admin alert
          whatsappService.sendAdminAlert(
            booking, user, slot, trainer, vehicle
          ).catch(err => console.error('Admin WhatsApp alert failed:', err));
        }
      }
    } catch (emailError) {
      console.error('Failed to send booking email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json(booking);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[Bookings][POST /] Rollback failed:', rollbackErr.message);
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('[Bookings][POST /] Error:', error.message, error.code);
    }
    
    // PHASE 5: Fix DIR-002 - Handle lock timeout errors (NOWAIT failures)
    // If slot is locked by another transaction, provide clear error message
    if (error.code === '55P03' || error.message.includes('could not obtain lock') || error.message.includes('lock not available')) {
      const lockError = new Error('This slot is currently being booked by another user. Please try again in a moment.');
      lockError.status = 409; // Conflict
      lockError.errorCode = 'SLOT_LOCKED';
      return next(lockError);
    }

    if (error.code === '23505') {
      const c = String(error.constraint || '');
      const d = String(error.detail || '');
      if (
        c.includes('slot_trainer') ||
        (d.includes('slot_id') && d.includes('trainer_id'))
      ) {
        const dup = new Error('This trainer is already booked for this time slot. Choose another trainer.');
        dup.status = 409;
        dup.errorCode = 'TRAINER_SLOT_TAKEN';
        return next(dup);
      }
    }

    // Convert common booking business validation errors to 400 instead of generic 500.
    if (!error.status) {
      error.status = 400;
      error.errorCode = error.errorCode || 'BOOKING_VALIDATION_ERROR';
    }
    
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

    // PHASE 1: Get user's phone number for phone-based validation
    const userCheck = await client.query(
      'SELECT phone FROM profiles WHERE id = $1',
      [req.user.id]
    );
    
    if (userCheck.rows.length === 0 || !userCheck.rows[0].phone) {
      throw new Error('User phone number not found');
    }

    const userPhone = userCheck.rows[0].phone;

    // PHASE 1: Use centralized cancellation validation (phone-based)
    const cancellationValidation = await validateCancellationEligibility(
      userPhone,
      req.params.id
    );

    if (!cancellationValidation.eligible) {
      const error = new Error(cancellationValidation.message || `Cancellation not allowed: ${cancellationValidation.reason}`);
      if (cancellationValidation.reason === 'BOOKING_NOT_FOUND') {
        error.status = 404;
      } else if (cancellationValidation.reason === 'ALREADY_CANCELLED') {
        error.status = 400;
      } else {
        error.status = 400;
      }
      throw error;
    }

    // PHASE 5: Fix MBR-004 - Require BOTH user_id match AND phone match
    // Business rule: "Only the same phone number can modify/cancel its booking"
    // Get booking details with phone verification
    const bookingResult = await client.query(
      `SELECT b.*, p.phone as booking_phone
       FROM bookings b
       JOIN profiles p ON b.user_id = p.id
       WHERE b.id = $1 AND b.user_id = $2 AND p.phone = $3`,
      [req.params.id, req.user.id, userPhone]
    );

    if (bookingResult.rows.length === 0) {
      // Check if booking exists but phone doesn't match
      const bookingExistsCheck = await client.query(
        'SELECT id FROM bookings WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );
      
      if (bookingExistsCheck.rows.length > 0) {
        throw new Error('Access denied. This booking belongs to a different phone number. Only the registered phone number can cancel bookings.');
      }
      
      throw new Error('Booking not found or does not belong to you');
    }

    const booking = bookingResult.rows[0];

    // Update booking - MUST include user_id check to prevent unauthorized updates
    const updateResult = await client.query(
      `UPDATE bookings
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by = $1,
           cancellation_reason = $2
       WHERE id = $3 AND user_id = $1
       RETURNING id`,
      [req.user.id, cancellation_reason, req.params.id]
    );

    // Verify update succeeded (defense in depth)
    if (updateResult.rows.length === 0) {
      const error = new Error('Access denied. This booking does not belong to you.');
      error.status = 403;
      throw error;
    }

    // Update slot booked_count (vehicle-specific counts are calculated dynamically from bookings table)
    // No need to update electric_booked/petrol_booked/bike_booked as they don't exist in slots table
    await client.query(
      `UPDATE slots 
       SET booked_count = GREATEST(booked_count - 1, 0)
       WHERE id = $1`,
      [booking.slot_id]
    );

    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      await auditService.logBookingCancellation(req.user.id, req.params.id, booking, cancellation_reason || 'Admin cancellation');
    } else {
      await auditService.logUserBookingCancellation(req.user.id, req.params.id, booking, cancellation_reason || 'User cancellation');
    }

    try {
      await client.query(
        `UPDATE student_entitlements
         SET used_slots = GREATEST(COALESCE(used_slots, 0) - 1, 0), updated_at = NOW()
         WHERE user_id = $1`,
        [req.user.id]
      );
    } catch (entErr) {
      if (entErr.code !== '42P01') {
        console.warn('[Bookings] student_entitlements used_slots decrement:', entErr.message);
      }
    }

    // Update slot aggregate status from booked_count (per-vehicle counts live in bookings + slot_vehicle_capacity)
    const slotStatusCheck = await client.query(
      `SELECT booked_count, capacity FROM slots WHERE id = $1`,
      [booking.slot_id]
    );
    
    if (slotStatusCheck.rows.length > 0) {
      const slot = slotStatusCheck.rows[0];
      const isFull = slot.booked_count >= slot.capacity;
      const isAvailable = slot.booked_count === 0;
      
      // Update status: full if at capacity, available if empty, otherwise keep current status
      if (isFull) {
        await client.query(
          `UPDATE slots SET status = 'full' WHERE id = $1`,
          [booking.slot_id]
        );
      } else if (isAvailable) {
        await client.query(
          `UPDATE slots SET status = $1 WHERE id = $2`,
          [config.slot.defaultStatus, booking.slot_id]
        );
      } else {
        // Remove 'full' status if capacity freed up
        await client.query(
          `UPDATE slots SET status = $1 WHERE id = $2 AND status = 'full'`,
          [config.slot.defaultStatus, booking.slot_id]
        );
      }
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
        const user = userResult.rows[0];
        const slot = slotResult.rows[0];
        const trainer = { full_name: trainerResult.rows[0].full_name };
        const vehicle = vehicleResult.rows[0] || { name: 'N/A', type: 'N/A' };

        // Send email notification
        emailService.sendBookingCancellation(
          booking, user, slot, trainer, vehicle
        ).catch(err => console.error('Email notification failed:', err));

        // Send WhatsApp notification
        if (user.phone) {
          whatsappService.sendBookingCancellation(
            booking, user, slot, trainer, vehicle
          ).catch(err => console.error('WhatsApp notification failed:', err));
        }
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
