// Export all validators for easy importing
const { validateLogin } = require('./auth.validator');
const { validateBookingCreation } = require('./booking.validator');
const { validateSlotCreation, validateSlotUpdate } = require('./slot.validator');
const {
  validateBookingStatusUpdate,
  validateTrainerCreation,
  validateTrainerUpdate,
  validateTrainerDelete,
  validateUserUpdate,
  validateUserRoleUpdate,
  validateUserCreation,
  validateSettingsUpdate,
  validateSettingUpdate,
  validateAdminChangePassword,
  validateAdminResetPassword,
  validateAdminAccountCreation,
  validateSubAdminCreation,
  validateAdminAccountUpdate,
  validateSubAdminUpdate
} = require('./admin.validator');
const {
  validateAdminCreation,
  validateAdminUpdate,
  validatePasswordReset,
  validatePasswordChange
} = require('./adminManagement.validator');
const { handleValidationErrors } = require('./common');

module.exports = {
  // Auth validators
  validateLogin,
  
  // Booking validators
  validateBookingCreation,
  
  // Slot validators
  validateSlotCreation,
  validateSlotUpdate,
  
  // Admin validators
  validateBookingStatusUpdate,
  validateTrainerCreation,
  validateTrainerUpdate,
  validateTrainerDelete,
  validateUserUpdate,
  validateUserRoleUpdate,
  validateUserCreation,
  validateSettingsUpdate,
  validateSettingUpdate,
  validateAdminChangePassword,
  validateAdminResetPassword,
  validateAdminAccountCreation,
  validateSubAdminCreation,
  validateAdminAccountUpdate,
  validateSubAdminUpdate,
  
  // Admin management validators
  validateAdminCreation,
  validateAdminUpdate,
  validatePasswordReset,
  validatePasswordChange,
  
  // Common utilities
  handleValidationErrors
};
