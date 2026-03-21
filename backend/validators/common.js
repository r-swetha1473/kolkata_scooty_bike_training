const { validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 * Returns consistent error format
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Format errors consistently
    const formattedErrors = errors.array().map(error => ({
      field: error.param || error.path,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    const first = formattedErrors[0];
    const summary = first
      ? `${first.field}: ${first.message}`
      : 'Validation failed';

    return res.status(400).json({
      success: false,
      message: summary,
      errorCode: 'VALIDATION_ERROR',
      error: 'Validation failed',
      errors: formattedErrors
    });
  }
  
  next();
};

module.exports = {
  handleValidationErrors
};
