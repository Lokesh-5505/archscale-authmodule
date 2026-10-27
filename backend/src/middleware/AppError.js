import { ERROR_CODES } from '../config/constants.js';

export class AppError extends Error {
  constructor(code = ERROR_CODES.INTERNAL_ERROR, message = 'An unexpected error occurred', statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
