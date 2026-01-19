const { body } = require('express-validator');
const { handleValidationErrors } = require('./common');

/**
 * Validation rules for booking creation
 */
const validateBookingCreation = [
  body('slot_id')
    .notEmpty()
    .withMessage('slot_id is required')
    .isUUID()
    .withMessage('slot_id must be a valid UUID'),
  
  body('trainer_id')
    .notEmpty()
    .withMessage('trainer_id is required')
    .isUUID()
    .withMessage('trainer_id must be a valid UUID'),
  
  body('vehicle_id')
    .notEmpty()
    .withMessage('vehicle_id is required')
    .isUUID()
    .withMessage('vehicle_id must be a valid UUID'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
    .escape(),
  
  handleValidationErrors
];

module.exports = {
  validateBookingCreation
};
