const AppError = require('./AppError');

/**
 * Forbidden Error - for authorization failures
 * Status Code: 403 Forbidden
 */
class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

module.exports = ForbiddenError;
