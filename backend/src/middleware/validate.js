import { AppError } from './AppError.js';
import { ERROR_CODES } from '../config/constants.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const parsed = schema.safeParse(dataToValidate);

      if (!parsed.success) {
        const formattedErrors = parsed.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          formattedErrors[0]?.message || 'Input validation failed',
          400,
          formattedErrors
        );
      }

      req[source] = parsed.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}
