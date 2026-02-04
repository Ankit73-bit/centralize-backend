const AppError = require('./AppError');

/**
 * Validation Error - for invalid input data
 * Status Code: 400 Bad Request
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

module.exports = ValidationError;
