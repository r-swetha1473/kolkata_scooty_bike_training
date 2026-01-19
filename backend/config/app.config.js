/**
 * Application Configuration Constants
 * Centralized magic numbers and configuration values
 */

// Slot capacity constants
const SLOT_CAPACITY = {
  MAX: 5,
  DEFAULT: 5
};

// Cancellation window (hours before slot start time)
const CANCELLATION_WINDOW_HOURS = 5;

// Cancellation deadline (hours before slot start time)
const CANCELLATION_DEADLINE_HOURS = 3;

// Slot visibility window (hours before slot start time)
const SLOT_VISIBILITY_HOURS = 24;

// Booking limits
// PHASE 1: Updated to 2 bookings per week per phone number (as per business requirements)
const WEEKLY_BOOKING_LIMIT = 2;
const TOTAL_BOOKING_LIMIT = 2;

// Booking advance window (hours before slot start time)
const BOOKING_ADVANCE_HOURS = 24;

// Entitlement validity period (days)
const ENTITLEMENT_VALIDITY_DAYS = 30;

module.exports = {
  SLOT_CAPACITY,
  CANCELLATION_WINDOW_HOURS,
  CANCELLATION_DEADLINE_HOURS,
  SLOT_VISIBILITY_HOURS,
  WEEKLY_BOOKING_LIMIT,
  TOTAL_BOOKING_LIMIT,
  BOOKING_ADVANCE_HOURS,
  ENTITLEMENT_VALIDITY_DAYS
};
