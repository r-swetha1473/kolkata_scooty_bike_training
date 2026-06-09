const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./common');

/**
 * Validation rules for booking status update
 */
const validateBookingStatusUpdate = [
  param('id')
    .isUUID()
    .withMessage('Booking ID must be a valid UUID'),
  
  body('status')
    .notEmpty()
    .withMessage('status is required')
    .isIn(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])
    .withMessage('status must be one of: pending, confirmed, completed, cancelled, no_show'),
  
  handleValidationErrors
];

/**
 * Validation rules for trainer creation
 */
const validateTrainerCreation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('full_name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('full_name must be between 2 and 100 characters')
    .escape(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  
  body('bio')
    .trim()
    .notEmpty()
    .withMessage('bio is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('bio must be between 10 and 1000 characters')
    .escape(),
  
  body('experience_years')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('experience_years must be an integer between 0 and 50')
    .toInt(),
  
  body('specialization')
    .optional()
    .isArray()
    .withMessage('specialization must be an array'),
  
  body('specialization.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each specialization item must not exceed 50 characters')
    .escape(),
  
  body('rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('rating must be a number between 0 and 5')
    .toFloat(),
  
  handleValidationErrors
];

/**
 * Validation rules for trainer update
 */
const validateTrainerUpdate = [
  param('id')
    .isUUID()
    .withMessage('Trainer ID must be a valid UUID'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('bio must be between 10 and 1000 characters')
    .escape(),
  
  body('experience_years')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('experience_years must be an integer between 0 and 50')
    .toInt(),
  
  body('specialization')
    .optional()
    .isArray()
    .withMessage('specialization must be an array'),
  
  body('specialization.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each specialization item must not exceed 50 characters')
    .escape(),
  
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('full_name must be between 2 and 100 characters')
    .escape(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  
  body('rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('rating must be a number between 0 and 5')
    .toFloat(),
  
  handleValidationErrors
];

/**
 * Validation rules for trainer delete with strategy
 */
const validateTrainerDelete = [
  param('id')
    .isUUID()
    .withMessage('Trainer ID must be a valid UUID'),

  body('strategy')
    .optional()
    .isIn(['direct', 'complete_all', 'complete_past', 'reassign'])
    .withMessage('strategy must be one of: direct, complete_all, complete_past, reassign'),

  body('reassignToTrainerId')
    .optional()
    .isUUID()
    .withMessage('reassignToTrainerId must be a valid UUID'),

  handleValidationErrors
];

/**
 * Validation rules for user update
 */
const validateUserUpdate = [
  param('id')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('full_name must be between 2 and 100 characters')
    .escape(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  body('total_bookings')
    .optional()
    .isInt({ min: 0 })
    .withMessage('total_bookings must be a non-negative integer')
    .toInt(),
  
  body('weekly_booking_count')
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage('weekly_booking_count must be an integer between 0 and 2')
    .toInt(),

  body('inactive_blocked')
    .optional()
    .isBoolean()
    .withMessage('inactive_blocked must be a boolean')
    .toBoolean(),
  
  handleValidationErrors
];

/**
 * Validation rules for user role update
 */
const validateUserRoleUpdate = [
  param('id')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  body('role')
    .notEmpty()
    .withMessage('role is required')
    .isIn(['customer', 'trainer', 'admin', 'superadmin'])
    .withMessage('role must be one of: customer, trainer, admin, superadmin'),
  
  handleValidationErrors
];

/**
 * Validation rules for user creation (superadmin only)
 */
const validateUserCreation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('full_name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('full_name must be between 2 and 100 characters')
    .escape(),
  
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  
  body('role')
    .notEmpty()
    .withMessage('role is required')
    .isIn(['customer', 'trainer', 'admin', 'superadmin'])
    .withMessage('role must be one of: customer, trainer, admin, superadmin'),
  
  handleValidationErrors
];

/**
 * Validation rules for settings update (multiple settings)
 */
const validateSettingsUpdate = [
  body()
    .custom((value) => {
      // Ensure at least one setting is provided
      if (Object.keys(value).length === 0) {
        throw new Error('At least one setting must be provided');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validation rules for single setting update
 */
const validateSettingUpdate = [
  param('key')
    .trim()
    .notEmpty()
    .withMessage('Setting key is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Setting key must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_\-\.]+$/)
    .withMessage('Setting key can only contain letters, numbers, underscores, hyphens, and dots'),
  
  body('value')
    .notEmpty()
    .withMessage('Setting value is required'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .escape(),
  
  handleValidationErrors
];

/**
 * Admin self-service password change
 */
const validateAdminChangePassword = [
  body('current_password')
    .trim()
    .notEmpty()
    .withMessage('Current password is required'),

  body('new_password')
    .trim()
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),

  body('confirm_password')
    .trim()
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Password confirmation must match');
      }
      return true;
    }),

  body('new_password')
    .custom((value, { req }) => {
      if (value === req.body.current_password) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Super admin password reset for admin/subadmin accounts
 */
const validateAdminResetPassword = [
  param('id')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),

  handleValidationErrors
];

module.exports = {
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
  validateAdminResetPassword
};
