const AppError = require('./AppError');

/**
 * Database Error - for database operation failures
 * Status Code: 500 Internal Server Error
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

module.exports = DatabaseError;
