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
    
    // Booking window (hours before slot start time)
    bookingWindowHours: 24,
    bookingWindowMessage: 'Slots can only be booked 24 hours in advance',
    
    // Cancellation window (hours before slot start time)
    cancellationWindowHours: 5,
    cancellationWindowMessage: 'Cancellation is only allowed up to 5 hours before the class start time',
    
    // Default booking status
    defaultStatus: 'confirmed',
    
    // Phone number validation
    phoneNumberPattern: /^[0-9]{10}$/,
    phoneNumberErrorMessage: 'Invalid phone number format. Please enter a 10-digit mobile number.'
  },

  // Slot configuration
  slot: {
    // Maximum capacity per slot
    maxCapacity: 5,
    maxCapacityErrorMessage: 'Invalid slot configuration: capacity exceeds maximum of 5',
    
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
    visibilityWindowMessage: 'Slot is not yet available for booking (opens 24 hours before start time)',
    
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
