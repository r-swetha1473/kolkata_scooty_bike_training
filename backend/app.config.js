/**
 * Application Configuration
 * Centralized configuration values used throughout the application
 */

module.exports = {
  // Booking configuration
  booking: {
    // Weekly booking limit
    weeklyLimit: 2,
    weeklyLimitMessage: 'Maximum 2 bookings per week allowed.',
    
    // Booking opens inside the 24 hours before the slot (not earlier)
    bookingWindowHours: 24,
    bookingWindowMessage: 'Booking opens 24 hours before the class. This slot is outside the booking window.',
    
    // Cancellation window (hours before slot start time)
    cancellationWindowHours: 5,
    cancellationWindowMessage: 'Cancellation is only allowed up to 5 hours before the class start time',

    // Minimum advance booking (hours before slot start)
    minAdvanceHours: 5,
    bookingAdvanceMessage: 'Bookings must be made at least 5 hours before the slot start time.',

    // Gap between consecutive customer bookings (hours)
    bookingGapHours: 48,
    
    // Default booking status
    defaultStatus: 'confirmed',
    
    // Phone number validation
    phoneNumberPattern: /^[0-9]{10}$/,
    phoneNumberErrorMessage: 'Invalid phone number format. Please enter a 10-digit mobile number.'
  },

  // Slot configuration
  slot: {
    // Maximum capacity per slot (aligned with DB CHECK 1–100; runtime uses SUM(vehicles.max_per_slot))
    maxCapacity: 100,
    maxCapacityErrorMessage: 'Invalid slot configuration: capacity must be between 1 and 100',
    
    // Default capacity
    defaultCapacity: 5,
    
    // Vehicle capacity defaults
    vehicleCapacity: {
      electric: 3,
      petrol: 1,
      bike: 1,
      total: 5
    },
    vehicleCapacityErrorMessage: 'Vehicle capacities must sum to 5 (Electric: 3, Petrol: 1, Bike: 1)',
    
    // Visibility window (hours before slot start time)
    visibilityWindowHours: 24,
    visibilityWindowMessage: 'This slot is not available for booking yet (opens 24 hours before start time)',
    
    // Default status
    defaultStatus: 'available',
    
    // Valid statuses
    validStatuses: ['available', 'cancelled', 'full', 'completed', 'disabled'],
    
    // Slot generation configuration
    generation: {
      // Weekday slots (Monday-Saturday)
      weekday: {
        startHour: 7,  // 7 AM
        endHour: 21,   // 9 PM
        intervalMinutes: 30
      },
      
      // Sunday slots
      sunday: {
        // Morning slots
        morning: [
          { hour: 10, minute: 30 },
          { hour: 11, minute: 0 },
          { hour: 11, minute: 30 },
          { hour: 12, minute: 0 },
          { hour: 12, minute: 30 }
        ],
        // Evening slots
        evening: {
          startHour: 15,  // 3 PM
          endHour: 20,   // 8 PM
          intervalMinutes: 30
        }
      },
      
      // Legacy fallback (for ensure-daily endpoint)
      legacy: {
        startHour: 9,   // 9 AM
        endHour: 21,   // 9 PM
        intervalMinutes: 30
      }
    }
  }
};
