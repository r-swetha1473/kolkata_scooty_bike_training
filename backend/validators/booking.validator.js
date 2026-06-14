const { body } = require('express-validator');
const { handleValidationErrors } = require('./common');

const ID_HINT =
  'Send JSON with slot_id (UUID), vehicle_id (UUID), and optional phone, notes.';

/**
 * Validation for POST /api/bookings (runs after normalizeBookingCreateBody).
 */
const validateBookingCreation = [
  body('slot_id')
    .notEmpty()
    .withMessage(`slot_id is required. ${ID_HINT}`)
    .bail()
    .isString()
    .withMessage('slot_id must be a string UUID')
    .bail()
    .isUUID()
    .withMessage('slot_id must be a valid UUID from the slots list'),

  body('trainer_id')
    .optional({ values: 'falsy' })
    .isUUID()
    .withMessage(`If trainer_id is sent it must be a valid UUID. ${ID_HINT}`),
  body('vehicle_id')
    .notEmpty()
    .withMessage(`vehicle_id is required. ${ID_HINT}`)
    .bail()
    .isString()
    .withMessage('vehicle_id must be a string UUID')
    .bail()
    .isUUID()
    .withMessage('vehicle_id must be a valid UUID for the selected vehicle type'),

  body('phone')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('phone must be a string')
    .bail()
    .matches(/^[0-9]{10}$/)
    .withMessage(
      'phone must be exactly 10 Indian mobile digits (you can send +91 or spaces; server normalizes to 10 digits)'
    ),

  body('notes')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('notes must be a string')
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('notes must not exceed 1000 characters')
    .escape(),

  handleValidationErrors
];

const validateOfflineBookingCreation = [
  body('slot_id')
    .notEmpty()
    .withMessage('slot_id is required')
    .bail()
    .isUUID()
    .withMessage('slot_id must be a valid UUID'),

  body('vehicle_id')
    .notEmpty()
    .withMessage('vehicle_id is required')
    .bail()
    .isUUID()
    .withMessage('vehicle_id must be a valid UUID'),

  body('customer_name')
    .notEmpty()
    .withMessage('Customer name is required')
    .bail()
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Customer name must be 1–120 characters'),

  body('phone')
    .optional({ values: 'falsy' })
    .isString()
    .matches(/^[0-9]{10}$/)
    .withMessage('phone must be exactly 10 digits when provided'),

  body('age')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 120 })
    .withMessage('age must be between 1 and 120'),

  body('gender')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 30 })
    .withMessage('gender must not exceed 30 characters'),

  body('notes')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('notes must not exceed 1000 characters')
    .escape(),

  body('reuse_user_id')
    .optional({ values: 'falsy' })
    .isUUID()
    .withMessage('reuse_user_id must be a valid UUID'),

  handleValidationErrors
];

module.exports = {
  validateBookingCreation,
  validateOfflineBookingCreation
};
