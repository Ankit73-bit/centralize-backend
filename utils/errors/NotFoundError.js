const AppError = require('./AppError');

/**
 * Not Found Error - for resources that don't exist
 * Status Code: 404 Not Found
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource', identifier = null) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    super(message, 404, 'NOT_FOUND', { resource, identifier });
  }
}

module.exports = NotFoundError;
