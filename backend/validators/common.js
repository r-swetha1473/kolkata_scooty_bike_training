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

    return res.status(400).json({
      error: 'Validation failed',
      errors: formattedErrors
    });
  }
  
  next();
};

module.exports = {
  handleValidationErrors
};
