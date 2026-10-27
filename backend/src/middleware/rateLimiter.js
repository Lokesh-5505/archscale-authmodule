import rateLimit from 'express-rate-limit';
import { ERROR_CODES, SECURITY_RULES } from '../config/constants.js';

export const authRateLimiter = rateLimit({
  windowMs: SECURITY_RULES.LOCKOUT_DURATION_MINUTES * 60 * 1000,
  max: SECURITY_RULES.MAX_FAILED_LOGINS_PER_IP,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      error: {
        code: ERROR_CODES.ACCOUNT_LOCKED,
        message: 'Too many requests. Please wait a few minutes before trying again.',
      },
    });
  },
});
