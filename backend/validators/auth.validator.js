const { body } = require('express-validator');
const { handleValidationErrors } = require('./common');

/**
 * Validation rules for admin login
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .isLength({ max: 100 })
    .withMessage('Password must not exceed 100 characters'),
  
  handleValidationErrors
];

module.exports = {
  validateLogin
};
