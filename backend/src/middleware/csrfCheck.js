import { AppError } from './AppError.js';
import { ERROR_CODES } from '../config/constants.js';
import { env } from '../config/env.js';

export function csrfCheck(req, res, next) {
  // Check Origin/Referer in non-GET requests if present
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

  if (origin) {
    const allowedOrigin = new URL(env.FRONTEND_URL).origin;
    // Allow matching frontend URL or localhost in development
    const isAllowed =
      origin === allowedOrigin ||
      (env.NODE_ENV !== 'production' && origin.includes('localhost'));

    if (!isAllowed) {
      return next(
        new AppError(ERROR_CODES.FORBIDDEN, 'CSRF verification failed: Origin disallowed', 403)
      );
    }
  }

  // Require standard anti-CSRF custom header for cookie-authenticated endpoints
  const requestedWith = req.headers['x-requested-with'] || req.headers['x-archscale-client'];
  if (!requestedWith && env.NODE_ENV === 'production') {
    return next(
      new AppError(ERROR_CODES.FORBIDDEN, 'Missing required client verification header', 403)
    );
  }

  next();
}
