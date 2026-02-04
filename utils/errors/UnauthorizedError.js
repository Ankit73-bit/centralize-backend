const AppError = require('./AppError');

/**
 * Unauthorized Error - for authentication failures
 * Status Code: 401 Unauthorized
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

module.exports = UnauthorizedError;
