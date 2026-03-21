const { body } = require('express-validator');
const { handleValidationErrors } = require('./common');

const ID_HINT =
  'Send JSON with snake_case: slot_id, vehicle_id (and optional phone, notes) — or camelCase: slotId, vehicleId. Trainer comes from the slot.';

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

  body('vehicle_id')
    .notEmpty()
    .withMessage(`vehicle_id is required. ${ID_HINT}`)
    .bail()
    .isString()
    .withMessage('vehicle_id must be a string UUID')
    .bail()
    .isUUID()
    .withMessage('vehicle_id must be a valid UUID from the vehicles list'),

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

module.exports = {
  validateBookingCreation
};
