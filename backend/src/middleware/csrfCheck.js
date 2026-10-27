import { AppError } from './AppError.js';
import { ERROR_CODES } from '../config/constants.js';
import { env } from '../config/env.js';

export function csrfCheck(req, res, next) {
  // Check Origin/Referer in non-GET requests if present
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch {
      origin = null;
    }
  }

  if (origin) {
    let allowedOrigin = null;
    try {
      if (env.FRONTEND_URL) {
        allowedOrigin = new URL(
          env.FRONTEND_URL.startsWith('http') ? env.FRONTEND_URL : `https://${env.FRONTEND_URL}`
        ).origin;
      }
    } catch {
      allowedOrigin = null;
    }

    const isAllowed =
      (allowedOrigin && origin === allowedOrigin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      env.NODE_ENV !== 'production';

    if (!isAllowed) {
      return next(
        new AppError(ERROR_CODES.FORBIDDEN, 'CSRF verification failed: Origin disallowed', 403)
      );
    }
  }

  // Require standard anti-CSRF custom header for cookie-authenticated endpoints
  const requestedWith = req.headers['x-requested-with'] || req.headers['x-archscale-client'];
  if (!requestedWith && env.NODE_ENV === 'production' && !req.body?.refreshToken) {
    return next(
      new AppError(ERROR_CODES.FORBIDDEN, 'Missing required client verification header', 403)
    );
  }

  next();
}
