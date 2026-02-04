const AppError = require('./AppError');

/**
 * File Processing Error - for file operation failures
 * Status Code: 422 Unprocessable Entity
 */
class FileProcessingError extends AppError {
  constructor(message = 'File processing failed', details = null) {
    super(message, 422, 'FILE_PROCESSING_ERROR', details);
  }
}

module.exports = FileProcessingError;
