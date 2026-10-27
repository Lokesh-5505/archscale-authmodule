import { Router } from 'express';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  logoutAllHandler,
  invitationLookupHandler,
  acceptInvitationHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  verifyEmailHandler,
  resendVerificationHandler,
  getMeHandler,
  getContextsHandler,
  setContextHandler,
  getSessionsHandler,
  revokeSessionHandler,
  revokeOtherSessionsHandler,
  changePasswordHandler,
} from './auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { csrfCheck } from '../../middleware/csrfCheck.js';
import {
  loginSchema,
  invitationLookupSchema,
  acceptInvitationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  setContextSchema,
  changePasswordSchema,
} from './auth.schemas.js';

const router = Router();

// ================= PUBLIC AUTH ROUTES =================
router.post('/login', authRateLimiter, validate(loginSchema), loginHandler);
router.post('/refresh', csrfCheck, refreshHandler);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), forgotPasswordHandler);
router.post('/reset-password', validate(resetPasswordSchema), resetPasswordHandler);
router.post('/invitations/lookup', validate(invitationLookupSchema), invitationLookupHandler);
router.post('/invitations/accept', validate(acceptInvitationSchema), acceptInvitationHandler);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmailHandler);
router.post('/resend-verification', authRateLimiter, validate(resendVerificationSchema), resendVerificationHandler);

// ================= AUTHENTICATED USER ROUTES =================
router.get('/me', authenticate, getMeHandler);
router.get('/contexts', authenticate, getContextsHandler);
router.post('/context', authenticate, validate(setContextSchema), setContextHandler);

// Session revocation & logout
router.post('/logout', authenticate, csrfCheck, logoutHandler);
router.post('/logout-all', authenticate, csrfCheck, logoutAllHandler);

// Device tracking & security
router.get('/sessions', authenticate, getSessionsHandler);
router.delete('/sessions/:id', authenticate, revokeSessionHandler);
router.post('/sessions/revoke-others', authenticate, revokeOtherSessionsHandler);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePasswordHandler);

export default router;
