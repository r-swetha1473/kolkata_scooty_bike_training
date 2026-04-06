/**
 * Centralized Booking Validation Service
 * PHASE 1: Requirement Alignment
 * 
 * This service provides a single source of truth for all booking eligibility checks.
 * Phone number is treated as the UNIQUE user identity across the system.
 */

const db = require('../db');
const config = require('../app.config');
const { normalizeIndianMobileDigits } = require('../utils/phoneNormalize');
const {
  WEEKLY_BOOKING_LIMIT,
  BOOKING_WINDOW_HOURS,
  SLOT_VISIBILITY_HOURS,
  CANCELLATION_WINDOW_HOURS
} = require('../config/app.config');
const vehicleService = require('./vehicle.service');

/**
 * Validates booking eligibility based on phone number, slot details, and vehicle
 * 
 * @param {string} phone - Phone number (10 digits, acts as unique user identity)
 * @param {string} slotDate - Slot date in YYYY-MM-DD format
 * @param {string} slotTime - Slot start time (ISO 8601 format)
 * @param {string} vehicleId - Vehicle UUID (required - no hardcoded types)
 * @param {string} slotId - Slot UUID (required for full validation)
 * @param {string} userId - User UUID (optional, for user_id based checks)
 * @param {string} trainerId - Trainer UUID (required when slotId is set; must be active and free for this slot)
 * @returns {Promise<{eligible: boolean, reason?: string, details?: object}>}
 */
async function validateBookingEligibility(phone, slotDate, slotTime, vehicleId, slotId = null, userId = null, trainerId = null) {
  try {
    const normalizedPhone = normalizeIndianMobileDigits(phone);
    
    // Validate phone number format (profiles may store +91 / 91 — normalize to 10 digits first)
    if (!config.booking.phoneNumberPattern.test(normalizedPhone)) {
      return {
        eligible: false,
        reason: 'INVALID_PHONE_FORMAT',
        message: config.booking.phoneNumberErrorMessage
      };
    }

    if (userId) {
      const profileRow = await db.query(
        'SELECT inactive_blocked, role FROM profiles WHERE id = $1',
        [userId]
      );
      const pr = profileRow.rows[0];
      if (pr?.role === 'customer' && pr?.inactive_blocked === true) {
        return {
          eligible: false,
          reason: 'INACTIVE_BLOCKED',
          message: 'Your account is inactive. Contact admin.'
        };
      }

      const activeBooking = await db.query(
        `SELECT b.id
         FROM bookings b
         JOIN slots s ON b.slot_id = s.id
         WHERE b.user_id = $1
           AND b.status NOT IN ('cancelled', 'completed', 'no_show')
           AND s.end_time > NOW()
         LIMIT 1`,
        [userId]
      );
      if (activeBooking.rows.length > 0) {
        return {
          eligible: false,
          reason: 'ACTIVE_BOOKING_EXISTS',
          message: 'You already have a booking. Cancel it to book another.'
        };
      }
    }

    // Validate vehicle_id - must be a UUID and vehicle must exist and be active
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(vehicleId)) {
      return {
        eligible: false,
        reason: 'INVALID_VEHICLE_ID',
        message: 'Invalid vehicle ID format'
      };
    }

    // Get vehicle details dynamically
    const vehicle = await vehicleService.getVehicleById(vehicleId);
    if (!vehicle) {
      return {
        eligible: false,
        reason: 'INVALID_VEHICLE',
        message: 'Vehicle not found'
      };
    }

    if (!vehicle.is_active) {
      return {
        eligible: false,
        reason: 'VEHICLE_INACTIVE',
        message: 'This vehicle is not currently available for booking'
      };
    }
    
    // Parse slot time
    const slotStartTime = new Date(slotTime);
    if (isNaN(slotStartTime.getTime())) {
      return {
        eligible: false,
        reason: 'INVALID_SLOT_TIME',
        message: 'Invalid slot time format'
      };
    }
    
    // Check 1: Booking opens 24 hours before the slot — only inside that window (slot in future, within BOOKING_WINDOW_HOURS)
    const currentTime = new Date();
    const hoursUntilSlot = (slotStartTime - currentTime) / (1000 * 60 * 60);

    if (hoursUntilSlot <= 0) {
      return {
        eligible: false,
        reason: 'SLOT_PAST',
        message: 'This slot has already started or passed.',
        details: { hoursUntilSlot }
      };
    }

    if (hoursUntilSlot > BOOKING_WINDOW_HOURS) {
      return {
        eligible: false,
        reason: 'BOOKING_NOT_OPEN_YET',
        message: `Booking opens ${BOOKING_WINDOW_HOURS} hours before the class. This slot starts in ${Math.round(hoursUntilSlot * 10) / 10} hours.`,
        details: { hoursUntilSlot, bookingWindowHours: BOOKING_WINDOW_HOURS }
      };
    }
    
    // Check 2: Weekly booking limit — use user_id when provided so counts stay correct inside a DB transaction
    // (phone on profiles may not be committed yet when validation runs on another pool connection).
    const weeklyBookingsResult = userId
      ? await db.query(
          `SELECT COUNT(*)::int as count
           FROM bookings b
           JOIN slots s ON b.slot_id = s.id
           WHERE b.user_id = $1
             AND b.status NOT IN ('cancelled')
             AND COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'UTC')::date) >= date_trunc('week', CURRENT_DATE)::date
             AND COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'UTC')::date) < (date_trunc('week', CURRENT_DATE) + INTERVAL '1 week')::date`,
          [userId]
        )
      : await db.query(
          `SELECT COUNT(*)::int as count
           FROM bookings b
           JOIN profiles p ON b.user_id = p.id
           JOIN slots s ON b.slot_id = s.id
           WHERE right(regexp_replace(p.phone, '\\D', '', 'g'), 10) = $1
             AND b.status NOT IN ('cancelled')
             AND COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'UTC')::date) >= date_trunc('week', CURRENT_DATE)::date
             AND COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'UTC')::date) < (date_trunc('week', CURRENT_DATE) + INTERVAL '1 week')::date`,
          [normalizedPhone]
        );
    
    const weeklyBookingsCount = parseInt(weeklyBookingsResult.rows[0]?.count || 0, 10);
    if (weeklyBookingsCount >= WEEKLY_BOOKING_LIMIT) {
      return {
        eligible: false,
        reason: 'WEEKLY_LIMIT_REACHED',
        message: `Weekly booking limit reached. You have ${weeklyBookingsCount} booking(s) this week. Maximum allowed: ${WEEKLY_BOOKING_LIMIT}.`,
        details: { weeklyCount: weeklyBookingsCount, limit: WEEKLY_BOOKING_LIMIT }
      };
    }
    
    // Check 3: student_entitlements (optional table — skip if missing)
    if (userId) {
      try {
        const entitlementCheck = await db.query(
          `SELECT total_slots, used_slots, expiry_date, first_booking_date
           FROM student_entitlements 
           WHERE user_id = $1`,
          [userId]
        );

        if (entitlementCheck.rows.length > 0) {
          const entitlement = entitlementCheck.rows[0];
          const currentDate = new Date();
          currentDate.setHours(0, 0, 0, 0);

          if (entitlement.expiry_date) {
            const expiryDate = new Date(entitlement.expiry_date);
            expiryDate.setHours(0, 0, 0, 0);

            if (currentDate > expiryDate) {
              return {
                eligible: false,
                reason: 'ENTITLEMENT_EXPIRED',
                message: `Your booking entitlement has expired on ${expiryDate.toLocaleDateString()}. Please contact support to renew your entitlements.`,
                details: { expiryDate: entitlement.expiry_date }
              };
            }
          }

          if (entitlement.used_slots >= entitlement.total_slots) {
            return {
              eligible: false,
              reason: 'QUOTA_EXHAUSTED',
              message: `You have used all your available booking slots (${entitlement.used_slots}/${entitlement.total_slots}). Please contact support to add more slots.`,
              details: { usedSlots: entitlement.used_slots, totalSlots: entitlement.total_slots }
            };
          }
        }
      } catch (entErr) {
        if (entErr.code === '42P01' || (entErr.message && entErr.message.includes('does not exist'))) {
          // Table not deployed — ignore
        } else {
          throw entErr;
        }
      }
    }
    
    // Check 4: Slot availability (if slotId provided)
    if (slotId) {
      if (!trainerId || !uuidPattern.test(String(trainerId))) {
        return {
          eligible: false,
          reason: 'TRAINER_REQUIRED',
          message: 'Please select a trainer for this slot.'
        };
      }

      // Get slot details and vehicle-specific booking counts
      const slotCheck = await db.query(
        `SELECT 
           s.id,
           s.start_time,
           s.end_time,
           s.slot_date,
           s.status,
           s.is_visible
         FROM slots s
         WHERE s.id = $1`,
        [slotId]
      );
      
      // Per-slot capacity from slot_vehicle_capacity when configured
      const vehicleBookedCount = await vehicleService.getVehicleBookedCount(slotId, vehicleId);
      const vehicleCapacity = await vehicleService.getEffectiveCapacityForSlot(slotId, vehicleId);
      
      if (slotCheck.rows.length === 0) {
        return {
          eligible: false,
          reason: 'SLOT_NOT_FOUND',
          message: 'Slot not found'
        };
      }
      
      const slot = slotCheck.rows[0];
      
      // Check slot status
      if (slot.status === 'disabled' || slot.status === 'cancelled') {
        return {
          eligible: false,
          reason: 'SLOT_NOT_AVAILABLE',
          message: 'Slot is not available for booking',
          details: { status: slot.status }
        };
      }
      
      // Visibility: show/book only when slot is within the booking window (same as Check 1)
      const slotStart = new Date(slot.start_time);
      const hoursUntil = (slotStart - currentTime) / (1000 * 60 * 60);
      const isCurrentlyVisible =
        hoursUntil > 0 && hoursUntil <= SLOT_VISIBILITY_HOURS;

      if (!slot.is_visible && !isCurrentlyVisible) {
        return {
          eligible: false,
          reason: 'SLOT_NOT_VISIBLE',
          message: config.slot.visibilityWindowMessage,
          details: { slotStartTime: slot.start_time, hoursUntil }
        };
      }

      const trainerRow = await db.query(
        `SELECT id, is_active FROM trainers WHERE id = $1`,
        [trainerId]
      );
      if (trainerRow.rows.length === 0) {
        return {
          eligible: false,
          reason: 'TRAINER_NOT_FOUND',
          message: 'Selected trainer was not found.'
        };
      }
      if (trainerRow.rows[0].is_active !== true) {
        return {
          eligible: false,
          reason: 'TRAINER_INACTIVE',
          message: 'This trainer is not available for booking.'
        };
      }

      const trainerTaken = await db.query(
        `SELECT 1 FROM bookings b
         WHERE b.slot_id = $1 AND b.trainer_id = $2 AND b.status NOT IN ('cancelled')
         LIMIT 1`,
        [slotId, trainerId]
      );
      if (trainerTaken.rows.length > 0) {
        return {
          eligible: false,
          reason: 'TRAINER_SLOT_TAKEN',
          message: 'This trainer is already booked for this time slot. Choose another trainer.'
        };
      }

      // Check vehicle-specific capacity dynamically
      if (vehicleBookedCount >= vehicleCapacity) {
        return {
          eligible: false,
          reason: 'VEHICLE_CAPACITY_FULL',
          message: `All ${vehicle.name} slots are full for this time slot (${vehicleBookedCount}/${vehicleCapacity} booked)`,
          details: { vehicleId, vehicleName: vehicle.name, bookedCount: vehicleBookedCount, capacity: vehicleCapacity }
        };
      }
    }
    
    // Check 5: duplicate booking (prefer user_id — same transaction / phone-update safety)
    if (slotId) {
      const duplicateCheck = userId
        ? await db.query(
            `SELECT b.id FROM bookings b
             WHERE b.user_id = $1 AND b.slot_id = $2 AND b.status NOT IN ('cancelled')`,
            [userId, slotId]
          )
        : await db.query(
            `SELECT b.id
             FROM bookings b
             JOIN profiles p ON b.user_id = p.id
             WHERE right(regexp_replace(p.phone, '\\D', '', 'g'), 10) = $1 AND b.slot_id = $2 AND b.status NOT IN ('cancelled')`,
            [normalizedPhone, slotId]
          );

      if (duplicateCheck.rows.length > 0) {
        return {
          eligible: false,
          reason: 'DUPLICATE_BOOKING',
          message: 'You already have a booking for this slot'
        };
      }
    }

    const effectiveVehicleCapacity = slotId
      ? await vehicleService.getEffectiveCapacityForSlot(slotId, vehicleId)
      : vehicle.max_per_slot;

    return {
      eligible: true,
      reason: 'VALID',
      message: 'Booking is eligible',
      details: {
        phone: normalizedPhone,
        slotDate,
        slotTime,
        vehicleId: vehicleId,
        vehicleName: vehicle.name,
        vehicleCapacity: effectiveVehicleCapacity,
        weeklyBookingsCount
      }
    };
    
  } catch (error) {
    console.error('[BookingValidation] Error validating booking eligibility:', {
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    const hint =
      error.code === '42P01'
        ? ' Database table missing (run migrations).'
        : '';
    const detail =
      process.env.NODE_ENV === 'development' && error.message
        ? ` (${error.message})`
        : '';
    return {
      eligible: false,
      reason: 'VALIDATION_ERROR',
      message: `Booking validation failed.${hint}${detail}`.trim(),
      errorCode: error.code || 'VALIDATION_EXCEPTION',
      error: error.message
    };
  }
  // PHASE 5: Fix LB-003 - Remove client.release() as this service uses db.query() directly, not a transaction client
  // No client cleanup needed here since we're not using a transaction client
}

/**
 * Validates cancellation eligibility
 * 
 * @param {string} phone - Phone number
 * @param {string} bookingId - Booking UUID
 * @returns {Promise<{eligible: boolean, reason?: string, message?: string}>}
 */
async function validateCancellationEligibility(phone, bookingId) {
  try {
    const normalizedPhone = normalizeIndianMobileDigits(phone);
    if (!config.booking.phoneNumberPattern.test(normalizedPhone)) {
      return {
        eligible: false,
        reason: 'INVALID_PHONE_FORMAT',
        message: config.booking.phoneNumberErrorMessage
      };
    }

    // Find booking by phone number
    const bookingCheck = await db.query(
      `SELECT b.*, s.start_time
       FROM bookings b
       JOIN profiles p ON b.user_id = p.id
       JOIN slots s ON b.slot_id = s.id
       WHERE right(regexp_replace(p.phone, '\\D', '', 'g'), 10) = $1 AND b.id = $2`,
      [normalizedPhone, bookingId]
    );
    
    if (bookingCheck.rows.length === 0) {
      return {
        eligible: false,
        reason: 'BOOKING_NOT_FOUND',
        message: 'Booking not found or does not belong to you'
      };
    }
    
    const booking = bookingCheck.rows[0];
    
    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return {
        eligible: false,
        reason: 'ALREADY_CANCELLED',
        message: 'Booking is already cancelled'
      };
    }
    
    // Check cancellation window (5 hours before slot)
    const slotStartTime = new Date(booking.start_time);
    const currentTime = new Date();
    const hoursUntilSlot = (slotStartTime - currentTime) / (1000 * 60 * 60);
    
    if (hoursUntilSlot <= CANCELLATION_WINDOW_HOURS) {
      return {
        eligible: false,
        reason: 'CANCELLATION_WINDOW_PASSED',
        message: config.booking.cancellationWindowMessage,
        details: { hoursUntilSlot, requiredHours: CANCELLATION_WINDOW_HOURS }
      };
    }
    
    return {
      eligible: true,
      reason: 'VALID',
      message: 'Cancellation is allowed'
    };
    
  } catch (error) {
    console.error('[BookingValidation] Error validating cancellation:', error);
    return {
      eligible: false,
      reason: 'VALIDATION_ERROR',
      message: 'An error occurred while validating cancellation eligibility',
      error: error.message
    };
  }
}

module.exports = {
  validateBookingEligibility,
  validateCancellationEligibility
};
