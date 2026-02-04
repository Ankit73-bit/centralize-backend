const { AppError } = require('../utils/errors');

/**
 * Global Error Handling Middleware
 * Catches all errors and sends formatted response
 */

/**
 * Development error response - includes stack trace
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      message: err.message,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      details: err.details,
      timestamp: err.timestamp,
      stack: err.stack
    }
  });
};

/**
 * Production error response - hides sensitive information
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode,
        errorCode: err.errorCode,
        details: err.details,
        timestamp: err.timestamp
      }
    });
  } else {
    // Programming or unknown error: don't leak error details
    console.error('ERROR 💥:', err);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Something went wrong on the server',
        statusCode: 500,
        errorCode: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Handle specific error types and convert them to AppError
 */
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_INPUT');
};

const handleDuplicateFieldsError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate field value: '${value}' for field '${field}'. Please use another value.`;
  return new AppError(message, 400, 'DUPLICATE_FIELD', { field, value });
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR', { errors });
};

const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
};

const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
};

const handleMulterError = (err) => {
  let message = 'File upload error';
  let details = null;

  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      message = 'File size exceeds the maximum allowed limit';
      details = { maxSize: err.limit };
      break;
    case 'LIMIT_FILE_COUNT':
      message = 'Too many files uploaded';
      details = { maxCount: err.limit };
      break;
    case 'LIMIT_UNEXPECTED_FILE':
      message = `Unexpected field: ${err.field}`;
      details = { field: err.field };
      break;
    default:
      message = err.message;
  }

  return new AppError(message, 400, 'FILE_UPLOAD_ERROR', details);
};

const handlePrismaError = (err) => {
  // Prisma Client Errors
  if (err.code === 'P2002') {
    // Unique constraint violation
    const field = err.meta?.target?.[0] || 'field';
    return new AppError(
      `A record with this ${field} already exists`,
      400,
      'DUPLICATE_RECORD',
      { field }
    );
  }

  if (err.code === 'P2025') {
    // Record not found
    return new AppError('Record not found', 404, 'NOT_FOUND');
  }

  if (err.code === 'P2003') {
    // Foreign key constraint violation
    return new AppError(
      'Invalid reference to related record',
      400,
      'INVALID_REFERENCE'
    );
  }

  // Generic Prisma error
  return new AppError('Database operation failed', 500, 'DATABASE_ERROR', {
    code: err.code
  });
};

/**
 * Main Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  error.timestamp = err.timestamp || new Date().toISOString();
  error.isOperational = err.isOperational || false;

  // Log error for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('Error Name:', err.name);
    console.log('Error Code:', err.code);
    console.log('Error:', err);
  }

  // Handle specific error types
  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateFieldsError(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (err.name === 'MulterError') error = handleMulterError(err);
  if (err.name === 'PrismaClientKnownRequestError') error = handlePrismaError(err);

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
