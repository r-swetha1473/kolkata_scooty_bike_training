const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./common');

/**
 * Validation rules for admin creation
 */
const validateAdminCreation = [
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
  
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['ADMIN', 'SUPER_ADMIN'])
    .withMessage('Role must be ADMIN or SUPER_ADMIN'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  
  handleValidationErrors
];

/**
 * Validation rules for admin update
 */
const validateAdminUpdate = [
  param('id')
    .isUUID()
    .withMessage('Admin ID must be a valid UUID'),
  
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('full_name must be between 2 and 100 characters')
    .escape(),
  
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
  
  body('role')
    .optional()
    .isIn(['ADMIN', 'SUPER_ADMIN'])
    .withMessage('Role must be ADMIN or SUPER_ADMIN'),
  
  handleValidationErrors
];

/**
 * Validation rules for password reset (SUPER_ADMIN only)
 */
const validatePasswordReset = [
  param('id')
    .isUUID()
    .withMessage('Admin ID must be a valid UUID'),
  
  body('new_password')
    .trim()
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  handleValidationErrors
];

/**
 * Validation rules for password change (logged-in admin changes own password)
 */
const validatePasswordChange = [
  body('old_password')
    .trim()
    .notEmpty()
    .withMessage('Old password is required'),
  
  body('new_password')
    .trim()
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('new_password')
    .custom((value, { req }) => {
      if (value === req.body.old_password) {
        throw new Error('New password must be different from old password');
      }
      return true;
    }),
  
  handleValidationErrors
];

module.exports = {
  validateAdminCreation,
  validateAdminUpdate,
  validatePasswordReset,
  validatePasswordChange
};
