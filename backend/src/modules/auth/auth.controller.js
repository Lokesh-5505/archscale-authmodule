import { authService } from './auth.service.js';
import { getClientIp } from '../../services/ip.service.js';
import { env } from '../../config/env.js';

const REFRESH_COOKIE_NAME = 'archscale_rt';

function setRefreshCookie(res, refreshToken, rememberMe = true) {
  const isProd = env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax', // 'none' for cross-domain Vercel/Railway, 'lax' for local/same-site
    path: '/',
  };

  if (rememberMe) {
    cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
}

function clearRefreshCookie(res) {
  const isProd = env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
}

export async function loginHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.login({
      ...req.body,
      userAgent,
      ip,
    });

    setRefreshCookie(res, result.refreshToken, req.body.rememberMe !== false);

    res.status(200).json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user,
      contexts: result.contexts,
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req, res, next) {
  try {
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const bodyToken = req.body?.refreshToken;
    const ip = getClientIp(req);

    let result;
    if (bodyToken) {
      try {
        result = await authService.refreshToken({ refreshToken: bodyToken, ip });
      } catch (err) {
        if (cookieToken && cookieToken !== bodyToken) {
          result = await authService.refreshToken({ refreshToken: cookieToken, ip });
        } else {
          throw err;
        }
      }
    } else if (cookieToken) {
      result = await authService.refreshToken({ refreshToken: cookieToken, ip });
    } else {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Missing refresh token', 401);
    }

    setRefreshCookie(res, result.refreshToken, true);

    res.status(200).json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
}

export async function logoutHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const jwt = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;

    await authService.logout({
      sessionId: req.auth.sessionId,
      userId: req.auth.userId,
      jwt,
      ip,
      userAgent,
    });

    clearRefreshCookie(res);
    res.status(200).json({ message: 'Signed out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function logoutAllHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const jwt = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;

    await authService.logoutAll({
      userId: req.auth.userId,
      jwt,
      ip,
      userAgent,
    });

    clearRefreshCookie(res);
    res.status(200).json({ message: 'All device sessions signed out' });
  } catch (err) {
    next(err);
  }
}

export async function invitationLookupHandler(req, res, next) {
  try {
    const { token } = req.body;
    const result = await authService.lookupInvitation(token);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function acceptInvitationHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.acceptInvitation({
      ...req.body,
      ip,
      userAgent,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function forgotPasswordHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

    const result = await authService.forgotPassword({
      id: req.body.id,
      frontendOrigin: origin,
      ip,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.resetPassword({
      token: req.body.token,
      newPassword: req.body.newPassword,
      ip,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyEmailHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.verifyEmail({
      token: req.body.token,
      ip,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function resendVerificationHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

    const result = await authService.resendVerification({
      id: req.body.id,
      frontendOrigin: origin,
      ip,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMeHandler(req, res, next) {
  try {
    const result = await authService.getMe({
      userId: req.auth.userId,
      sessionId: req.auth.sessionId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getContextsHandler(req, res, next) {
  try {
    const contexts = await authService.getContexts(req.auth.userId);
    res.status(200).json({ contexts });
  } catch (err) {
    next(err);
  }
}

export async function setContextHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.setContext({
      userId: req.auth.userId,
      sessionId: req.auth.sessionId,
      tenantUserId: req.body.tenantUserId,
      ip,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSessionsHandler(req, res, next) {
  try {
    const sessions = await authService.getSessions({
      userId: req.auth.userId,
      currentSessionId: req.auth.sessionId,
    });

    res.status(200).json({ sessions });
  } catch (err) {
    next(err);
  }
}

export async function revokeSessionHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.revokeSession({
      userId: req.auth.userId,
      sessionIdToRevoke: req.params.id,
      currentSessionId: req.auth.sessionId,
      ip,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function revokeOtherSessionsHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const jwt = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;

    const result = await authService.revokeOtherSessions({
      userId: req.auth.userId,
      currentSessionId: req.auth.sessionId,
      jwt,
      ip,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await authService.changePassword({
      userId: req.auth.userId,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      currentSessionId: req.auth.sessionId,
      ip,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
