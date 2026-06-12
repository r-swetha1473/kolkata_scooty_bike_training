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
  CANCELLATION_WINDOW_HOURS,
  MIN_BOOKING_ADVANCE_HOURS,
  BOOKING_GAP_HOURS
} = require('../config/app.config');
const { formatKolkataDateTime } = require('../utils/dateUtils');
const vehicleService = require('./vehicle.service');
const {
  getProfileInactiveStatus,
  isCustomerInactiveBlocked
} = require('../utils/profileInactive');

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
 * @param {{ excludeBookingId?: string, mode?: 'create'|'update' }} [options]
 * @returns {Promise<{eligible: boolean, reason?: string, details?: object}>}
 */
async function validateBookingEligibility(
  phone,
  slotDate,
  slotTime,
  vehicleId,
  slotId = null,
  userId = null,
  trainerId = null,
  options = {}
) {
  const { excludeBookingId = null, mode = 'create' } = options;
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

    let isCustomer = true;
    if (userId) {
      const pr = await getProfileInactiveStatus(userId);
      isCustomer = !pr.role || pr.role === 'customer';
      if (isCustomerInactiveBlocked(pr)) {
        return {
          eligible: false,
          reason: 'INACTIVE_BLOCKED',
          message: 'Your account is inactive. Contact admin.'
        };
      }

      if (isCustomer && mode === 'create' && slotDate) {
        const activeBooking = await db.query(
          `SELECT b.id, s.start_time, s.slot_date
           FROM bookings b
           JOIN slots s ON b.slot_id = s.id
           WHERE b.user_id = $1
             AND b.status NOT IN ('cancelled', 'completed', 'no_show')
             AND s.end_time > NOW()
             AND COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'UTC')::date) = $2::date
           LIMIT 1`,
          [userId, slotDate]
        );
        if (activeBooking.rows.length > 0) {
          return {
            eligible: false,
            reason: 'ACTIVE_BOOKING_EXISTS',
            message: 'You already have a booking on this date. Cancel or update your existing booking.'
          };
        }
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

    const currentTime = new Date();
    const hoursUntilSlot = (slotStartTime - currentTime) / (1000 * 60 * 60);
    let weeklyBookingsCount = 0;

    if (isCustomer) {
      // Check 2: Weekly booking limit (unchanged — calendar week count)
      if (mode === 'create') {
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

        weeklyBookingsCount = parseInt(weeklyBookingsResult.rows[0]?.count || 0, 10);
        if (weeklyBookingsCount >= WEEKLY_BOOKING_LIMIT) {
          return {
            eligible: false,
            reason: 'WEEKLY_LIMIT_REACHED',
            message: `Weekly booking limit reached. You have ${weeklyBookingsCount} booking(s) this week. Maximum allowed: ${WEEKLY_BOOKING_LIMIT}.`,
            details: { weeklyCount: weeklyBookingsCount, limit: WEEKLY_BOOKING_LIMIT }
          };
        }
      }

      // Check 3: 48-hour gap between customer bookings
      const gapParams = userId
        ? [userId, excludeBookingId, slotStartTime.toISOString()]
        : [normalizedPhone, excludeBookingId, slotStartTime.toISOString()];
      const gapQuery = userId
        ? `SELECT s.start_time
           FROM bookings b
           JOIN slots s ON b.slot_id = s.id
           WHERE b.user_id = $1
             AND b.status NOT IN ('cancelled')
             AND ($2::uuid IS NULL OR b.id <> $2)
             AND $3::timestamptz < s.start_time + INTERVAL '${BOOKING_GAP_HOURS} hours'
             AND $3::timestamptz > s.start_time - INTERVAL '${BOOKING_GAP_HOURS} hours'
           ORDER BY s.start_time ASC
           LIMIT 1`
        : `SELECT s.start_time
           FROM bookings b
           JOIN profiles p ON b.user_id = p.id
           JOIN slots s ON b.slot_id = s.id
           WHERE right(regexp_replace(p.phone, '\\D', '', 'g'), 10) = $1
             AND b.status NOT IN ('cancelled')
             AND ($2::uuid IS NULL OR b.id <> $2)
             AND $3::timestamptz < s.start_time + INTERVAL '${BOOKING_GAP_HOURS} hours'
             AND $3::timestamptz > s.start_time - INTERVAL '${BOOKING_GAP_HOURS} hours'
           ORDER BY s.start_time ASC
           LIMIT 1`;

      const gapConflict = await db.query(gapQuery, gapParams);
      if (gapConflict.rows.length > 0) {
        const conflictStart = new Date(gapConflict.rows[0].start_time);
        const nextAllowed =
          slotStartTime >= conflictStart
            ? new Date(conflictStart.getTime() + BOOKING_GAP_HOURS * 60 * 60 * 1000)
            : new Date(slotStartTime.getTime() + BOOKING_GAP_HOURS * 60 * 60 * 1000);
        return {
          eligible: false,
          reason: 'BOOKING_GAP_48H',
          message: `You already have a booking within the last 48 hours. Your next booking can be made after ${formatKolkataDateTime(nextAllowed)}.`,
          details: { nextAllowed: nextAllowed.toISOString(), gapHours: BOOKING_GAP_HOURS }
        };
      }

      // Check 4: Minimum 5-hour advance (Kolkata business rule — timestamptz vs NOW())
      const advanceCheck = await db.query(
        `SELECT ($1::timestamptz < NOW() + INTERVAL '${MIN_BOOKING_ADVANCE_HOURS} hours') AS too_soon`,
        [slotStartTime.toISOString()]
      );
      if (advanceCheck.rows[0]?.too_soon) {
        return {
          eligible: false,
          reason: 'BOOKING_ADVANCE_REQUIRED',
          message: config.booking.bookingAdvanceMessage,
          details: {
            minAdvanceHours: MIN_BOOKING_ADVANCE_HOURS,
            hoursUntilSlot: Math.round(hoursUntilSlot * 10) / 10
          }
        };
      }
    }

    // Existing booking window: slot must be in the future and within 24h visibility window
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
    
    // Duplicate booking guard (create only)
    if (slotId && mode === 'create') {
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
