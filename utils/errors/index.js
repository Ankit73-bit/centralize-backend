/**
 * Central export for all custom error classes
 */

const AppError = require('./AppError');
const ValidationError = require('./ValidationError');
const NotFoundError = require('./NotFoundError');
const FileProcessingError = require('./FileProcessingError');
const DatabaseError = require('./DatabaseError');
const UnauthorizedError = require('./UnauthorizedError');
const ForbiddenError = require('./ForbiddenError');

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  FileProcessingError,
  DatabaseError,
  UnauthorizedError,
  ForbiddenError
};
