import { env } from '../config/env.js';
import { AppError } from './AppError.js';
import { ERROR_CODES } from '../config/constants.js';

export function errorHandler(err, req, res, next) {
  // Check if error is an instance of AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || undefined,
      },
    });
  }

  // Handle Mongoose CastError or ValidationError
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: err.message,
      },
    });
  }

  // Handle generic / unexpected errors
  console.error('💥 Unhandled Exception:', err);

  const statusCode = err.status || err.statusCode || 500;
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  return res.status(statusCode).json({
    error: {
      code: err.code || ERROR_CODES.INTERNAL_ERROR,
      message,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}
