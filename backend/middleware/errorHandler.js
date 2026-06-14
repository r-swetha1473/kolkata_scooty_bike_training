/**
 * Error Handler Middleware
 * Standardizes error responses and handles error logging
 */

const {
  formatSchemaPgError,
  SCHEMA_PG_CODES
} = require('../services/offlineBookingSchema.service');

/**
 * Standardized error response format
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Determine if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

  // Extract error information
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.code || err.errorCode || 'INTERNAL_ERROR';
  let schemaDetail = null;

  // PostgreSQL schema drift (missing column/type/function/table)
  if (err.code && SCHEMA_PG_CODES.has(err.code)) {
    statusCode = 503;
    errorCode = 'SCHEMA_MISMATCH';
    message = 'Database schema is out of date. Contact support or retry after maintenance.';
    schemaDetail = formatSchemaPgError(err);
    console.error('[Schema] SCHEMA_MISMATCH — PostgreSQL object missing:', {
      ...schemaDetail,
      url: req.originalUrl,
      method: req.method,
      hint:
        'Apply migrations 20260614120000, 20260615120000, then 20260407120000 on Render DATABASE_URL. Run: node scripts/verify_offline_booking_schema.js'
    });
  }

  // Handle specific error types
  // Database errors
  if (err.code && err.code.startsWith('23')) {
    // PostgreSQL constraint violations
    statusCode = 400;
    if (err.code === '23505') {
      message = 'Duplicate entry. This record already exists.';
      errorCode = 'DUPLICATE_ENTRY';
    } else if (err.code === '23503') {
      message = 'Foreign key constraint violation.';
      errorCode = 'FOREIGN_KEY_VIOLATION';
    } else {
      message = 'Database constraint violation.';
      errorCode = 'DATABASE_CONSTRAINT_ERROR';
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = err.message || 'Invalid or expired token';
    errorCode =
      err.errorCode ||
      (err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
  }

  // Validation errors (from express-validator)
  if (err.errors && Array.isArray(err.errors)) {
    statusCode = 400;
    message = 'Validation failed';
    errorCode = 'VALIDATION_ERROR';
  }

  // Suppress verbose logging for expected authentication check failures
  // These are normal when checking auth status without a token or when user isn't authenticated
  const isAuthCheck = req.originalUrl === '/api/auth/me' && errorCode === 'NO_TOKEN';
  const isExpectedAuthError = isAuthCheck || 
    (req.originalUrl === '/api/auth/me' && errorCode === 'INVALID_TOKEN');
  
  // For 401 errors on protected endpoints, log at info level instead of error level
  // These are expected when users aren't authenticated yet
  const isUnauthenticatedRequest = statusCode === 401 && 
    (errorCode === 'NO_TOKEN' || errorCode === 'INVALID_TOKEN' || errorCode === 'AUTHENTICATION_ERROR');

  // Log error details
  if (isExpectedAuthError) {
    // Suppress logging for auth check endpoint
    // (no logging needed)
  } else if (isUnauthenticatedRequest) {
    // Log unauthenticated requests at debug/info level (not error level)
    // This is expected behavior when users aren't logged in
    if (isDevelopment) {
      console.log(`[Auth] Unauthenticated request to ${req.method} ${req.originalUrl} - ${errorCode}`);
    }
  } else {
    // Log actual errors with full details
    if (isDevelopment) {
      // In development: log full stack trace
      console.error('Error Details:', {
        message,
        errorCode,
        statusCode,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query
      });
    } else {
      // In production: log minimal information (schema errors already logged above with pg detail)
      if (errorCode !== 'SCHEMA_MISMATCH') {
        console.error('Error:', {
          message,
          errorCode,
          statusCode,
          url: req.originalUrl,
          method: req.method
        });
      }
    }
  }

  const response = {
    success: false,
    message,
    errorCode
  };

  if (err.errors && Array.isArray(err.errors)) {
    response.errors = err.errors;
  }

  // Optional structured payload (409 conflicts, validation hints)
  const extraData = {};
  if (err.nextAvailableDate != null) extraData.nextAvailableDate = err.nextAvailableDate;
  if (err.existingDate != null) extraData.existingDate = err.existingDate;
  if (err.suggestedDate != null) extraData.suggestedDate = err.suggestedDate;
  if (err.requestedDate != null) extraData.requestedDate = err.requestedDate;
  if (err.allowedDate != null) extraData.allowedDate = err.allowedDate;
  if (Object.keys(extraData).length > 0) {
    response.data = extraData;
  }

  if (isDevelopment && schemaDetail) {
    response.schemaDetail = schemaDetail;
  }

  // Include stack trace in development mode only
  if (isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
