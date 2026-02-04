/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors and pass them to error middleware
 * 
 * Usage:
 * router.get('/route', asyncHandler(async (req, res, next) => {
 *   // Your async code here
 *   // No need for try-catch!
 * }));
 */

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
