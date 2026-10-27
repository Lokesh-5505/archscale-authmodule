import { AppError } from './AppError.js';
import { ERROR_CODES } from '../config/constants.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !req.auth.user) {
      return next(new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401));
    }

    const userRole = req.auth.platformRole;
    if (!allowedRoles.includes(userRole)) {
      return next(
        new AppError(
          ERROR_CODES.FORBIDDEN,
          'You do not have administrative permission to perform this action',
          403
        )
      );
    }

    next();
  };
}
