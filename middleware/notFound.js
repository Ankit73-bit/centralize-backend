const { NotFoundError } = require('../utils/errors');

/**
 * 404 Not Found Middleware
 * Handles requests to undefined routes
 */
const notFound = (req, res, next) => {
  const error = new NotFoundError('Route', req.originalUrl);
  next(error);
};

module.exports = notFound;
