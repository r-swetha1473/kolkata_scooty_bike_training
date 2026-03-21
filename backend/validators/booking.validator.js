const { body } = require('express-validator');
const { handleValidationErrors } = require('./common');

/**
 * Validation rules for booking creation
 */
const validateBookingCreation = [
  body('slot_id')
    .trim()
    .notEmpty()
    .withMessage('slot_id is required (the time slot you selected)')
    .isUUID()
    .withMessage('slot_id must be a valid UUID from the slots list'),

  body('trainer_id')
    .trim()
    .notEmpty()
    .withMessage('trainer_id is required (select a trainer)')
    .isUUID()
    .withMessage('trainer_id must be a valid UUID from the trainers list'),

  body('vehicle_id')
    .trim()
    .notEmpty()
    .withMessage('vehicle_id is required (select a vehicle)')
    .isUUID()
    .withMessage('vehicle_id must be a valid UUID from the vehicles list'),

  // Treat null / empty as "not sent" so optional fields do not fail .matches / .isLength
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('phone must be exactly 10 digits (no spaces or country code)'),

  body('notes')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('notes must not exceed 1000 characters')
    .escape(),

  handleValidationErrors
];

module.exports = {
  validateBookingCreation
};
