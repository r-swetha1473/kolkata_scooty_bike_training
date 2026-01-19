const { body } = require('express-validator');
const { handleValidationErrors } = require('./common');

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
    .isInt({ min: 1, max: 5 })
    .withMessage('capacity must be an integer between 1 and 5')
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
  
  body('electric_capacity')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('electric_capacity must be an integer between 0 and 5')
    .toInt(),
  
  body('petrol_capacity')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('petrol_capacity must be an integer between 0 and 5')
    .toInt(),
  
  body('bike_capacity')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('bike_capacity must be an integer between 0 and 5')
    .toInt(),
  
  body()
    .custom((value) => {
      // Validate that vehicle capacities sum to 5 if all are provided
      if (value.electric_capacity !== undefined && 
          value.petrol_capacity !== undefined && 
          value.bike_capacity !== undefined) {
        const sum = value.electric_capacity + value.petrol_capacity + value.bike_capacity;
        if (sum !== 5) {
          throw new Error('Vehicle capacities (electric_capacity + petrol_capacity + bike_capacity) must sum to 5');
        }
      }
      return true;
    }),
  
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
    .isInt({ min: 1, max: 5 })
    .withMessage('capacity must be an integer between 1 and 5')
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
  
  body('electric_capacity')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('electric_capacity must be an integer between 0 and 5')
    .toInt(),
  
  body('petrol_capacity')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('petrol_capacity must be an integer between 0 and 5')
    .toInt(),
  
  body('bike_capacity')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('bike_capacity must be an integer between 0 and 5')
    .toInt(),
  
  handleValidationErrors
];

module.exports = {
  validateSlotCreation,
  validateSlotUpdate
};
