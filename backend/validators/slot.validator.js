const { body } = require('express-validator');
const { handleValidationErrors } = require('./common');
const { SLOT_CAPACITY } = require('../config/app.config');

const CAPACITY_MIN = 1;
const CAPACITY_MAX = SLOT_CAPACITY.MAX;

/**
 * Validation rules for slot creation
 */
const validateSlotCreation = [
  body('trainer_id')
    .optional()
    .isUUID()
    .withMessage('trainer_id must be a valid UUID'),

  body('start_time')
    .notEmpty()
    .withMessage('start_time is required')
    .isISO8601()
    .withMessage('start_time must be a valid ISO 8601 date string')
    .toDate(),

  body('end_time')
    .notEmpty()
    .withMessage('end_time is required')
    .isISO8601()
    .withMessage('end_time must be a valid ISO 8601 date string')
    .toDate()
    .custom((endTime, { req }) => {
      if (req.body.start_time && new Date(endTime) <= new Date(req.body.start_time)) {
        throw new Error('end_time must be after start_time');
      }
      return true;
    }),

  body('capacity')
    .optional()
    .isInt({ min: CAPACITY_MIN, max: CAPACITY_MAX })
    .withMessage(`capacity must be an integer between ${CAPACITY_MIN} and ${CAPACITY_MAX}`)
    .toInt(),

  body('status')
    .optional()
    .isIn(['available', 'full', 'cancelled', 'completed', 'disabled'])
    .withMessage('status must be one of: available, full, cancelled, completed, disabled'),

  body('slot_date')
    .optional()
    .isISO8601()
    .withMessage('slot_date must be a valid ISO 8601 date string')
    .toDate(),

  body('is_auto_generated')
    .optional()
    .isBoolean()
    .withMessage('is_auto_generated must be a boolean')
    .toBoolean(),

  handleValidationErrors
];

/**
 * Validation rules for slot update
 */
const validateSlotUpdate = [
  body('trainer_id')
    .optional()
    .isUUID()
    .withMessage('trainer_id must be a valid UUID'),

  body('start_time')
    .notEmpty()
    .withMessage('start_time is required')
    .isISO8601()
    .withMessage('start_time must be a valid ISO 8601 date string')
    .toDate(),

  body('end_time')
    .notEmpty()
    .withMessage('end_time is required')
    .isISO8601()
    .withMessage('end_time must be a valid ISO 8601 date string')
    .toDate()
    .custom((endTime, { req }) => {
      if (req.body.start_time && new Date(endTime) <= new Date(req.body.start_time)) {
        throw new Error('end_time must be after start_time');
      }
      return true;
    }),

  body('capacity')
    .optional()
    .isInt({ min: CAPACITY_MIN, max: CAPACITY_MAX })
    .withMessage(`capacity must be an integer between ${CAPACITY_MIN} and ${CAPACITY_MAX}`)
    .toInt(),

  body('status')
    .optional()
    .isIn(['available', 'full', 'cancelled', 'completed', 'disabled'])
    .withMessage('status must be one of: available, full, cancelled, completed, disabled'),

  body('booked_count')
    .optional()
    .isInt({ min: 0 })
    .withMessage('booked_count must be a non-negative integer')
    .toInt(),

  body('slot_date')
    .optional()
    .isISO8601()
    .withMessage('slot_date must be a valid ISO 8601 date string')
    .toDate(),

  handleValidationErrors
];

module.exports = {
  validateSlotCreation,
  validateSlotUpdate
};
