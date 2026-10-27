import { supabaseAdmin, supabaseClient } from '../config/supabase.js';
import { User, Session } from '../models/index.js';
import { AppError } from './AppError.js';
import { ERROR_CODES, SESSION_LIMITS } from '../config/constants.js';
import { env } from '../config/env.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication token required', 401);
    }

    const token = authHeader.split(' ')[1];

    // Decode token payload
    let payload;
    try {
      const base64Payload = token.split('.')[1];
      payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));
    } catch {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Malformed authentication token', 401);
    }

    // Verify token validity with Supabase Auth
    // In dev mode with placeholder keys, allow graceful mock fallback
    let supabaseUser = null;
    if (!env.SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabaseClient.auth.getUser(token);
      if (error || !data?.user) {
        throw new AppError(ERROR_CODES.TOKEN_EXPIRED, 'Session token expired or invalid', 401);
      }
      supabaseUser = data.user;
    } else {
      // In local dev without real Supabase connection, check expiration from JWT exp claim
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new AppError(ERROR_CODES.TOKEN_EXPIRED, 'Session token expired', 401);
      }
    }

    const supabaseSessionId = payload.session_id || payload.sub;
    if (!supabaseSessionId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Token missing session identifier', 401);
    }

    // Lookup session in our application database (latest record)
    let session = await Session.findOne({ supabaseSessionId }).sort({ createdAt: -1 });
    if (!session && payload.sub) {
      // Fallback: look up user by supabase user ID and check for their active session
      const user = await User.findOne({ supabaseUserId: payload.sub });
      if (user) {
        session = await Session.findOne({ userId: user._id, revokedAt: null }).sort({ updatedAt: -1 });
        if (session) {
          // Re-sync session with current supabaseSessionId
          session.supabaseSessionId = supabaseSessionId;
          session.save().catch(() => {});
        }
      }
    }
    if (!session) {
      throw new AppError(ERROR_CODES.SESSION_REVOKED, 'Session not recognized or revoked', 401);
    }

    if (!session.isValid()) {
      if (session.revokedAt) {
        throw new AppError(ERROR_CODES.SESSION_REVOKED, 'This session has been revoked', 401);
      }
      throw new AppError(ERROR_CODES.SESSION_EXPIRED, 'Your session has expired', 401);
    }

    // Load user record
    const user = await User.findById(session.userId);
    if (!user) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'User account not found', 401);
    }

    if (user.status === 'disabled') {
      throw new AppError(
        ERROR_CODES.ACCOUNT_DISABLED,
        'This account is turned off. Contact ArchScale.',
        403
      );
    }

    // Throttle lastActiveAt updates (at most once every 5 minutes)
    const fiveMinutesMs = SESSION_LIMITS.ACTIVITY_UPDATE_INTERVAL_MINUTES * 60 * 1000;
    if (Date.now() - new Date(session.lastActiveAt).getTime() > fiveMinutesMs) {
      session.lastActiveAt = new Date();
      session.save().catch((err) => console.error('Failed to update session activity:', err.message));
    }

    // Attach to request
    req.auth = {
      user,
      userId: user._id,
      supabaseUserId: user.supabaseUserId,
      platformRole: user.platformRole,
      session,
      sessionId: session._id,
      supabaseSessionId: session.supabaseSessionId,
      activeTenantUserId: session.activeTenantUserId,
    };

    next();
  } catch (err) {
    next(err);
  }
}
