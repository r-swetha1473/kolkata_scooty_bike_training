/**
 * Centralized Booking Validation Service
 * PHASE 1: Requirement Alignment
 * 
 * This service provides a single source of truth for all booking eligibility checks.
 * Phone number is treated as the UNIQUE user identity across the system.
 */

const db = require('../db');
const config = require('../app.config');
const {
  WEEKLY_BOOKING_LIMIT,
  BOOKING_ADVANCE_HOURS,
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
 * @returns {Promise<{eligible: boolean, reason?: string, details?: object}>}
 */
async function validateBookingEligibility(phone, slotDate, slotTime, vehicleId, slotId = null, userId = null) {
  try {
    // Normalize phone number (remove spaces, ensure 10 digits)
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Validate phone number format
    if (!config.booking.phoneNumberPattern.test(normalizedPhone)) {
      return {
        eligible: false,
        reason: 'INVALID_PHONE_FORMAT',
        message: config.booking.phoneNumberErrorMessage
      };
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
    
    // Check 1: 24-hour advance booking rule
    const currentTime = new Date();
    const hoursUntilSlot = (slotStartTime - currentTime) / (1000 * 60 * 60);
    
    if (hoursUntilSlot < BOOKING_ADVANCE_HOURS) {
      return {
        eligible: false,
        reason: 'SLOT_TOO_SOON',
        message: `Bookings must be made at least ${BOOKING_ADVANCE_HOURS} hours in advance. The selected slot starts in ${Math.round(hoursUntilSlot * 10) / 10} hours.`,
        details: { hoursUntilSlot, requiredHours: BOOKING_ADVANCE_HOURS }
      };
    }
    
    // Check 2: Weekly booking limit (per phone number)
    // PHASE 5: Fix LB-004 - Count bookings by slot_date (when slot occurs) instead of created_at (when booking was made)
    // This prevents gaming the system by booking slots for different weeks on the same day
    // Count bookings by phone number where slot_date falls in current week (Monday to Sunday)
    const weeklyBookingsResult = await db.query(
      `SELECT COUNT(*) as count
       FROM bookings b
       JOIN profiles p ON b.user_id = p.id
       JOIN slots s ON b.slot_id = s.id
       WHERE p.phone = $1
         AND b.status NOT IN ('cancelled')
         AND s.slot_date >= date_trunc('week', CURRENT_DATE)
         AND s.slot_date < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'`,
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
    
    // Check 3: Total slot entitlement (if userId provided)
    if (userId) {
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
        
        // Check if entitlement has expired
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
        
        // Check if all slots have been used
        if (entitlement.used_slots >= entitlement.total_slots) {
          return {
            eligible: false,
            reason: 'QUOTA_EXHAUSTED',
            message: `You have used all your available booking slots (${entitlement.used_slots}/${entitlement.total_slots}). Please contact support to add more slots.`,
            details: { usedSlots: entitlement.used_slots, totalSlots: entitlement.total_slots }
          };
        }
      }
    }
    
    // Check 4: Slot availability (if slotId provided)
    if (slotId) {
      // Get slot details and vehicle-specific booking counts
      // Note: Currently bookings table uses vehicle_id, not vehicle_type
      // In PHASE 2, we'll add vehicle_type column to bookings table
      const slotCheck = await db.query(
        `SELECT 
           s.id,
           s.start_time,
           s.end_time,
           s.slot_date,
           s.status,
           s.is_visible,
           s.electric_capacity,
           s.petrol_capacity,
           s.bike_capacity,
           s.trainer_id,
           t.is_active as trainer_is_active
         FROM slots s
         LEFT JOIN trainers t ON s.trainer_id = t.id
         WHERE s.id = $1`,
        [slotId]
      );
      
      // Get vehicle-specific booking count for this vehicle dynamically
      const vehicleBookedCount = await vehicleService.getVehicleBookedCount(slotId, vehicleId);
      const vehicleCapacity = vehicle.max_per_slot;
      
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
      
      // PHASE 5: Fix MBR-001 - Check slot visibility (24-hour rule)
      // Business rule: Slot becomes visible when current_time >= slot_start_time - 24 hours
      // If slot.is_visible is false, re-check dynamically (in case visibility changed since slot creation)
      const slotStart = new Date(slot.start_time);
      const visibilityThreshold = new Date(currentTime.getTime() + SLOT_VISIBILITY_HOURS * 60 * 60 * 1000);
      
      // Slot is visible if slot_start_time <= current_time + 24 hours
      const isCurrentlyVisible = slotStart <= visibilityThreshold;
      
      if (!slot.is_visible && !isCurrentlyVisible) {
        return {
          eligible: false,
          reason: 'SLOT_NOT_VISIBLE',
          message: config.slot.visibilityWindowMessage,
          details: { slotStartTime: slot.start_time, visibilityThreshold }
        };
      }
      
      // Check trainer availability
      if (!slot.trainer_id || !slot.trainer_is_active) {
        return {
          eligible: false,
          reason: 'TRAINER_NOT_ASSIGNED',
          message: 'No trainer assigned to this slot or trainer is inactive'
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
    
    // Check 5: Prevent duplicate booking for same phone + slot
    if (slotId) {
      const duplicateCheck = await db.query(
        `SELECT b.id
         FROM bookings b
         JOIN profiles p ON b.user_id = p.id
         WHERE p.phone = $1
           AND b.slot_id = $2
           AND b.status NOT IN ('cancelled')`,
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
    
    // All checks passed
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
        vehicleCapacity: vehicle.max_per_slot,
        weeklyBookingsCount
      }
    };
    
  } catch (error) {
    console.error('[BookingValidation] Error validating booking eligibility:', error);
    return {
      eligible: false,
      reason: 'VALIDATION_ERROR',
      message: 'An error occurred while validating booking eligibility',
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
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Find booking by phone number
    const bookingCheck = await db.query(
      `SELECT b.*, s.start_time
       FROM bookings b
       JOIN profiles p ON b.user_id = p.id
       JOIN slots s ON b.slot_id = s.id
       WHERE p.phone = $1 AND b.id = $2`,
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
