import mongoose from 'mongoose';
import crypto from 'crypto';
import {
  User,
  Organization,
  Tenant,
  Membership,
  TenantUser,
  Invitation,
  AuthToken,
  Session,
  LoginAttempt,
  AuthEvent,
} from '../../models/index.js';
import { supabaseAdmin, supabaseClient } from '../../config/supabase.js';
import { generateToken, hashToken } from '../../services/token.service.js';
import { parseDevice } from '../../services/device.service.js';
import { mailService } from '../../services/mail.service.js';
import { AppError } from '../../middleware/AppError.js';
import {
  ERROR_CODES,
  SECURITY_RULES,
  SESSION_LIMITS,
  TOKEN_EXPIRY,
  PLATFORM_ROLES,
} from '../../config/constants.js';
import { env } from '../../config/env.js';

class AuthService {
  /**
   * 1. LOGIN
   */
  async login({ id, username, email, userId, password, rememberMe = true, userAgent = '', ip = '127.0.0.1' }) {
    const rawTarget = (username || email || id || userId || '').trim();
    const idTarget = rawTarget.toLowerCase();

    // 1. Check failed login attempts lockout
    const [idAttempts, ipAttempts] = await Promise.all([
      LoginAttempt.countDocuments({ idTarget }),
      LoginAttempt.countDocuments({ ip }),
    ]);

    if (
      idAttempts >= SECURITY_RULES.MAX_FAILED_LOGINS_PER_ID ||
      ipAttempts >= SECURITY_RULES.MAX_FAILED_LOGINS_PER_IP
    ) {
      throw new AppError(
        ERROR_CODES.ACCOUNT_LOCKED,
        'Too many failed login attempts. Please wait 15 minutes before trying again.',
        429
      );
    }

    // 2. Lookup user by usernameLower OR userIdLower OR email
    const user = await User.findOne({
      $or: [
        { userIdLower: idTarget },
        { usernameLower: idTarget },
        { email: idTarget },
      ],
    });

    if (!user) {
      await LoginAttempt.create({ idTarget, ip });
      throw new AppError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Username, email, or password is incorrect.',
        401
      );
    }

    // 3. Authenticate with Supabase
    let supabaseSessionId = null;
    let accessToken = null;
    let refreshToken = null;
    let expiresIn = TOKEN_EXPIRY.ACCESS_TOKEN_SECONDS;

    if (!env.SUPABASE_URL.includes('placeholder')) {
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError || !authData?.session) {
        await LoginAttempt.create({ idTarget, ip });
        await AuthEvent.create({
          type: 'failed_login',
          userId: user._id,
          ip,
          userAgent,
          meta: { reason: authError?.message || 'Invalid password' },
        });
        throw new AppError(
          ERROR_CODES.INVALID_CREDENTIALS,
          'Username, email, or password is incorrect.',
          401
        );
      }

      accessToken = authData.session.access_token;
      refreshToken = authData.session.refresh_token;
      expiresIn = authData.session.expires_in || TOKEN_EXPIRY.ACCESS_TOKEN_SECONDS;

      // Extract Supabase session ID from JWT or session payload
      const base64Payload = accessToken.split('.')[1];
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));
      supabaseSessionId = payload.session_id || authData.session.user.id;
    } else {
      // Local dev mock mode
      supabaseSessionId = `dev-session-${crypto.randomUUID()}`;
      // Generate a mock JWT with session_id claim for dev
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          session_id: supabaseSessionId,
          sub: user.supabaseUserId,
          email: user.email,
          exp: Math.floor(Date.now() / 1000) + 900,
        })
      ).toString('base64');
      accessToken = `${header}.${payload}.devsignature`;
      refreshToken = `dev-refresh-${crypto.randomUUID()}`;
    }

    // 4. Check if account is disabled
    if (user.status === 'disabled') {
      throw new AppError(
        ERROR_CODES.ACCOUNT_DISABLED,
        'This account is turned off. Contact ArchScale.',
        403
      );
    }

    // 5. Successful login: clear login attempts for this target
    await LoginAttempt.deleteMany({ idTarget });

    // 6. Compute session expiration based on rememberMe
    const now = new Date();
    const expiresAt = rememberMe
      ? new Date(now.getTime() + SESSION_LIMITS.REMEMBERED_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + SESSION_LIMITS.EPHEMERAL_MAX_AGE_HOURS * 60 * 60 * 1000);

    const device = parseDevice(userAgent);

    // 7. Create Session document
    const session = await Session.create({
      supabaseSessionId,
      userId: user._id,
      rememberMe,
      device,
      ip,
      expiresAt,
      lastActiveAt: now,
    });

    // 8. Load user profiles (contexts)
    const contexts = await this.getContexts(user._id);

    // 9. Log audit event
    await AuthEvent.create({
      type: 'login',
      userId: user._id,
      ip,
      userAgent,
      meta: { sessionId: session._id, rememberMe },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user._id,
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        initials: user.initials,
        platformRole: user.platformRole,
        lastContextId: user.lastContextId,
      },
      contexts,
      sessionId: session._id,
    };
  }

  /**
   * 2. REFRESH TOKEN
   */
  async refreshToken({ refreshToken, ip = '127.0.0.1' }) {
    if (!refreshToken) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Missing refresh token', 401);
    }

    let newAccessToken = null;
    let newRefreshToken = null;
    let supabaseSessionId = null;

    if (!env.SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabaseClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data?.session) {
        throw new AppError(ERROR_CODES.SESSION_REVOKED, 'Invalid or expired refresh token', 401);
      }

      newAccessToken = data.session.access_token;
      newRefreshToken = data.session.refresh_token;

      const base64Payload = newAccessToken.split('.')[1];
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));
      supabaseSessionId = payload.session_id || data.session.user.id;
    } else {
      // Mock dev mode
      supabaseSessionId = `dev-session-refreshed`;
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          session_id: supabaseSessionId,
          exp: Math.floor(Date.now() / 1000) + 900,
        })
      ).toString('base64');
      newAccessToken = `${header}.${payload}.devsignature`;
      newRefreshToken = `dev-refresh-${crypto.randomUUID()}`;
    }

    // Verify session state in our database
    let session = await Session.findOne({ supabaseSessionId });
    if (!session && env.NODE_ENV !== 'production') {
      // Fallback for dev mode
      session = await Session.findOne({ revokedAt: null }).sort({ updatedAt: -1 });
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

    // Update session last active time & IP
    session.lastActiveAt = new Date();
    session.ip = ip;
    await session.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: TOKEN_EXPIRY.ACCESS_TOKEN_SECONDS,
    };
  }

  /**
   * 3. LOGOUT (Current device)
   */
  async logout({ sessionId, userId, jwt, ip, userAgent }) {
    const session = await Session.findById(sessionId);
    if (session && !session.revokedAt) {
      session.revokedAt = new Date();
      session.revokedReason = 'logout';
      await session.save();

      // Sign out from Supabase if real connection
      if (jwt && !env.SUPABASE_URL.includes('placeholder')) {
        await supabaseAdmin.auth.admin.signOut(jwt, 'local').catch((err) => {
          console.warn('Supabase local signOut notice:', err.message);
        });
      }

      await AuthEvent.create({
        type: 'logout',
        userId,
        ip,
        userAgent,
        meta: { sessionId },
      });
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * 4. LOGOUT ALL
   */
  async logoutAll({ userId, jwt, ip, userAgent }) {
    await Session.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'logout_all' } }
    );

    if (jwt && !env.SUPABASE_URL.includes('placeholder')) {
      await supabaseAdmin.auth.admin.signOut(jwt, 'global').catch((err) => {
        console.warn('Supabase global signOut notice:', err.message);
      });
    }

    await AuthEvent.create({
      type: 'logout_all',
      userId,
      ip,
      userAgent,
    });

    return { message: 'All sessions logged out successfully' };
  }

  /**
   * 5. INVITATION LOOKUP
   */
  async lookupInvitation(rawToken) {
    const tokenHash = hashToken(rawToken);
    const invitation = await Invitation.findOne({ tokenHash });

    if (!invitation) {
      throw new AppError(ERROR_CODES.LINK_INVALID, 'This invitation link is invalid or does not exist.', 404);
    }

    if (invitation.status === 'accepted') {
      throw new AppError(
        ERROR_CODES.LINK_INVALID,
        'This invitation has already been used. Please log in with your credentials.',
        400
      );
    }

    if (invitation.status === 'cancelled') {
      throw new AppError(
        ERROR_CODES.LINK_INVALID,
        'This invitation was cancelled. Please request a new invitation from your administrator.',
        400
      );
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      invitation.status = 'expired';
      await invitation.save();
      throw new AppError(
        ERROR_CODES.TOKEN_EXPIRED,
        'This invitation link has expired. Please ask your administrator to resend it.',
        410
      );
    }

    return {
      valid: true,
      email: invitation.email,
      tenantType: invitation.tenantType,
      organizationName: invitation.organizationName,
      mode: invitation.mode,
      prefill: invitation.prefill || {},
    };
  }

  /**
   * 6. ACCEPT INVITATION & REGISTRATION
   */
  async acceptInvitation({
    token,
    userId,
    username,
    fullName,
    password,
    organizationName,
    ip = '127.0.0.1',
    userAgent = '',
  }) {
    const tokenHash = hashToken(token);
    const invitation = await Invitation.findOne({ tokenHash });

    if (!invitation || invitation.status !== 'pending' || new Date() > new Date(invitation.expiresAt)) {
      throw new AppError(
        ERROR_CODES.LINK_INVALID,
        'Invalid or expired invitation link. Please request a new invite.',
        400
      );
    }

    // Check if username/User ID is already taken
    const chosenUsername = (username || userId || '').trim();
    const usernameLower = chosenUsername.toLowerCase();
    const existingUser = await User.findOne({
      $or: [{ userIdLower: usernameLower }, { usernameLower }],
    });
    if (existingUser) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'This username is already taken. Please choose another one.',
        409
      );
    }

    // Create Supabase User
    let supabaseUserId;
    if (!env.SUPABASE_URL.includes('placeholder')) {
      const { data: suUser, error: suError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
      });

      if (suError) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, `Failed to initialize auth user: ${suError.message}`, 500);
      }
      supabaseUserId = suUser.user.id;
    } else {
      supabaseUserId = crypto.randomUUID();
    }

    // Atomic MongoDB record creation
    const dbSession = await mongoose.startSession().catch(() => null);
    const useTransaction = dbSession && mongoose.connection.replicaSet;

    try {
      if (useTransaction) {
        dbSession.startTransaction();
      }
      const opts = useTransaction ? { session: dbSession } : {};

      // 1. Create User
      const [user] = await User.create(
        [
          {
            supabaseUserId,
            userId: chosenUsername,
            username: chosenUsername,
            email: invitation.email,
            fullName,
            platformRole: null, // Subscriber
            status: 'active',
            emailVerifiedAt: new Date(),
          },
        ],
        opts
      );

      // 2. Create Organization
      const orgName = organizationName || invitation.organizationName || `${fullName}'s Studio`;
      const [organization] = await Organization.create([{ name: orgName }], opts);

      // 3. Create Tenant
      const [tenant] = await Tenant.create(
        [
          {
            organizationId: organization._id,
            tenantType: invitation.tenantType,
          },
        ],
        opts
      );

      // 4. Create Membership
      const [membership] = await Membership.create(
        [
          {
            tenantId: tenant._id,
            status: 'active',
            startsAt: invitation.membershipStartsAt || new Date(),
            endsAt: invitation.membershipEndsAt,
            createdBy: invitation.invitedBy,
          },
        ],
        opts
      );

      // 5. Create TenantUser
      const [tenantUser] = await TenantUser.create(
        [
          {
            userId: user._id,
            tenantId: tenant._id,
            role: 'owner',
            status: 'active',
          },
        ],
        opts
      );

      // Set user's lastContextId
      user.lastContextId = tenantUser._id;
      await user.save(opts);

      // 6. Mark Invitation as accepted
      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      await invitation.save(opts);

      // 7. Audit event
      await AuthEvent.create(
        [
          {
            type: 'invite_accepted',
            userId: user._id,
            ip,
            userAgent,
            meta: {
              organizationId: organization._id,
              tenantId: tenant._id,
              membershipId: membership._id,
            },
          },
        ],
        opts
      );

      if (useTransaction) {
        await dbSession.commitTransaction();
      }

      return {
        success: true,
        message: 'Account successfully registered. You may now sign in.',
        user: {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
        },
      };
    } catch (err) {
      if (useTransaction) {
        await dbSession.abortTransaction().catch(() => {});
      }
      // Rollback Supabase user if created
      if (!env.SUPABASE_URL.includes('placeholder') && supabaseUserId) {
        await supabaseAdmin.auth.admin.deleteUser(supabaseUserId).catch(() => {});
      }
      throw err;
    } finally {
      if (dbSession) {
        dbSession.endSession().catch(() => {});
      }
    }
  }

  /**
   * 7. FORGOT PASSWORD
   */
  async forgotPassword({ id, username, email, frontendOrigin, ip, userAgent }) {
    const rawTarget = (username || email || id || '').trim();
    const idTarget = rawTarget.toLowerCase();
    const user = await User.findOne({
      $or: [
        { userIdLower: idTarget },
        { usernameLower: idTarget },
        { email: idTarget },
      ],
      status: 'active',
    });

    if (user) {
      // Clean up previous unused reset tokens
      await AuthToken.deleteMany({ userId: user._id, purpose: 'reset_password' });

      const baseUrl = (frontendOrigin && typeof frontendOrigin === 'string' && !frontendOrigin.includes('placeholder'))
        ? frontendOrigin.replace(/\/+$/, '')
        : (env.FRONTEND_URL || 'https://archscale.in').replace(/\/+$/, '');

      const rawToken = generateToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.RESET_PASSWORD_HOURS * 60 * 60 * 1000);

      await AuthToken.create({
        userId: user._id,
        purpose: 'reset_password',
        tokenHash,
        expiresAt,
      });

      const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;

      await mailService.sendResetPassword({
        to: user.email,
        link: resetLink,
        userName: user.fullName,
        expiresAt,
      });

      await AuthEvent.create({
        type: 'reset_requested',
        userId: user._id,
        ip,
        userAgent,
      });
    }

    // Always return 200 with identical message
    return {
      message: 'If this account exists, we have sent a password reset link to its registered email.',
    };
  }

  /**
   * 8. RESET PASSWORD
   */
  async resetPassword({ token, newPassword, ip, userAgent }) {
    const tokenHash = hashToken(token);
    const authToken = await AuthToken.findOne({
      tokenHash,
      purpose: 'reset_password',
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!authToken) {
      throw new AppError(
        ERROR_CODES.LINK_INVALID,
        'This password reset link is invalid or has expired. Please request a new link.',
        400
      );
    }

    const user = await User.findById(authToken.userId);
    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User account not found', 404);
    }

    // Update password in Supabase
    if (!env.SUPABASE_URL.includes('placeholder')) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.supabaseUserId, {
        password: newPassword,
      });

      if (error) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, `Failed to update password: ${error.message}`, 500);
      }

      // Global Supabase logout
      await supabaseAdmin.auth.admin.signOut(user.supabaseUserId, { scope: 'global' }).catch(() => {});
    }

    // Mark token as used
    authToken.usedAt = new Date();
    await authToken.save();

    // Revoke all existing sessions for this user
    await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'password_reset' } }
    );

    // Audit and notify
    await AuthEvent.create({
      type: 'reset_completed',
      userId: user._id,
      ip,
      userAgent,
    });

    await mailService.sendPasswordChangedNotice({
      to: user.email,
      userName: user.fullName,
    });

    return {
      message: 'Your password has been reset successfully. Please log in with your new password.',
    };
  }

  /**
   * 9. EMAIL VERIFICATION
   */
  async verifyEmail({ token, ip, userAgent }) {
    const tokenHash = hashToken(token);
    const authToken = await AuthToken.findOne({
      tokenHash,
      purpose: 'verify_email',
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!authToken) {
      throw new AppError(ERROR_CODES.LINK_INVALID, 'Verification link is invalid or has expired.', 400);
    }

    const user = await User.findById(authToken.userId);
    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404);
    }

    user.emailVerifiedAt = new Date();
    await user.save();

    authToken.usedAt = new Date();
    await authToken.save();

    await AuthEvent.create({
      type: 'email_verified',
      userId: user._id,
      ip,
      userAgent,
    });

    return { message: 'Your email address has been verified successfully.' };
  }

  /**
   * 10. RESEND VERIFICATION
   */
  async resendVerification({ id, username, email, frontendOrigin, ip, userAgent }) {
    const rawTarget = (username || email || id || '').trim();
    const idTarget = rawTarget.toLowerCase();
    const user = await User.findOne({
      $or: [
        { userIdLower: idTarget },
        { usernameLower: idTarget },
        { email: idTarget },
      ],
      status: 'active',
    });

    if (user && !user.emailVerifiedAt) {
      await AuthToken.deleteMany({ userId: user._id, purpose: 'verify_email' });

      const baseUrl = (frontendOrigin && typeof frontendOrigin === 'string' && !frontendOrigin.includes('placeholder'))
        ? frontendOrigin.replace(/\/+$/, '')
        : (env.FRONTEND_URL || 'https://archscale.in').replace(/\/+$/, '');

      const rawToken = generateToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.VERIFY_EMAIL_HOURS * 60 * 60 * 1000);

      await AuthToken.create({
        userId: user._id,
        purpose: 'verify_email',
        tokenHash,
        expiresAt,
      });

      const verifyLink = `${baseUrl}/verify-email?token=${rawToken}`;
      await mailService.sendVerifyEmail({
        to: user.email,
        link: verifyLink,
        userName: user.fullName,
        expiresAt,
      });
    }

    return {
      message: 'If this unverified account exists, a verification link has been sent.',
    };
  }

  /**
   * 11. GET CURRENT USER (ME)
   */
  async getMe({ userId, sessionId }) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404);
    }

    const session = await Session.findById(sessionId);

    let activeContext = null;
    if (session?.activeTenantUserId) {
      const tenantUser = await TenantUser.findById(session.activeTenantUserId)
        .populate({
          path: 'tenantId',
          populate: { path: 'organizationId' },
        })
        .lean();

      if (tenantUser?.tenantId) {
        const membership = await Membership.findOne({ tenantId: tenantUser.tenantId._id }).lean();
        activeContext = {
          tenantUserId: tenantUser._id,
          role: tenantUser.role,
          tenantType: tenantUser.tenantId.tenantType,
          organizationName: tenantUser.tenantId.organizationId?.name || '',
          membershipActive: membership
            ? membership.status === 'active' &&
              new Date(membership.startsAt) <= new Date() &&
              new Date() <= new Date(membership.endsAt)
            : false,
        };
      }
    }

    return {
      user: {
        id: user._id,
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        initials: user.initials,
        platformRole: user.platformRole,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      activeContext,
    };
  }

  /**
   * 12. GET CONTEXTS ("Who are you today?")
   */
  async getContexts(userId) {
    const user = await User.findById(userId);
    if (!user) return [];

    const tenantUsers = await TenantUser.find({ userId, status: 'active' })
      .populate({
        path: 'tenantId',
        populate: { path: 'organizationId' },
      })
      .lean();

    const contexts = [];
    for (const tu of tenantUsers) {
      if (!tu.tenantId) continue;

      const membership = await Membership.findOne({ tenantId: tu.tenantId._id }).lean();
      const now = new Date();
      const isActive = membership
        ? membership.status === 'active' &&
          new Date(membership.startsAt) <= now &&
          now <= new Date(membership.endsAt)
        : false;

      const isLastUsed = user.lastContextId
        ? user.lastContextId.toString() === tu._id.toString()
        : false;

      contexts.push({
        tenantUserId: tu._id,
        tenantId: tu.tenantId._id,
        tenantType: tu.tenantId.tenantType,
        organizationName: tu.tenantId.organizationId?.name || 'ArchScale Organization',
        role: tu.role,
        isLastUsed,
        isActive,
        membershipEndsAt: membership?.endsAt || null,
        membershipStatus: membership?.status || 'suspended',
      });
    }

    return contexts;
  }

  /**
   * 13. SET CONTEXT
   */
  async setContext({ userId, sessionId, tenantUserId, ip, userAgent }) {
    const tenantUser = await TenantUser.findOne({
      _id: tenantUserId,
      userId,
      status: 'active',
    }).populate('tenantId');

    if (!tenantUser) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'You do not have permission to act under this profile',
        403
      );
    }

    // Verify membership is active
    const membership = await Membership.findOne({ tenantId: tenantUser.tenantId._id });
    if (!membership || !membership.isActive()) {
      throw new AppError(
        ERROR_CODES.MEMBERSHIP_INACTIVE,
        'This organization membership access period has concluded. Contact ArchScale.',
        403
      );
    }

    // Save on session and user
    await Session.findByIdAndUpdate(sessionId, { activeTenantUserId: tenantUser._id });
    await User.findByIdAndUpdate(userId, { lastContextId: tenantUser._id });

    await AuthEvent.create({
      type: 'context_switched',
      userId,
      ip,
      userAgent,
      meta: { tenantUserId, tenantId: tenantUser.tenantId._id },
    });

    return {
      message: 'Active profile set successfully',
      activeTenantUserId: tenantUser._id,
    };
  }

  /**
   * 14. GET SESSIONS (Device list)
   */
  async getSessions({ userId, currentSessionId }) {
    const now = new Date();
    const sessions = await Session.find({
      userId,
      revokedAt: null,
      expiresAt: { $gt: now },
    })
      .sort({ lastActiveAt: -1 })
      .lean();

    return sessions.map((s) => ({
      id: s._id,
      device: s.device,
      ip: s.ip,
      rememberMe: s.rememberMe,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      isCurrent: s._id.toString() === currentSessionId.toString(),
    }));
  }

  /**
   * 15. REVOKE ONE DEVICE
   */
  async revokeSession({ userId, sessionIdToRevoke, currentSessionId, ip, userAgent }) {
    if (sessionIdToRevoke === currentSessionId.toString()) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'Cannot revoke your current active session. Use Logout instead.',
        400
      );
    }

    const session = await Session.findOne({ _id: sessionIdToRevoke, userId });
    if (!session) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Session not found', 404);
    }

    session.revokedAt = new Date();
    session.revokedReason = 'revoked_by_user';
    await session.save();

    await AuthEvent.create({
      type: 'session_revoked',
      userId,
      ip,
      userAgent,
      meta: { revokedSessionId: sessionIdToRevoke },
    });

    return { message: 'Device session revoked successfully' };
  }

  /**
   * 16. REVOKE OTHER SESSIONS
   */
  async revokeOtherSessions({ userId, currentSessionId, jwt, ip, userAgent }) {
    await Session.updateMany(
      {
        userId,
        _id: { $ne: currentSessionId },
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revokedReason: 'logout_all',
        },
      }
    );

    if (jwt && !env.SUPABASE_URL.includes('placeholder')) {
      await supabaseAdmin.auth.admin.signOut(jwt, 'others').catch((err) => {
        console.warn('Supabase others signOut notice:', err.message);
      });
    }

    await AuthEvent.create({
      type: 'other_sessions_revoked',
      userId,
      ip,
      userAgent,
      meta: { preservedSessionId: currentSessionId },
    });

    return { message: 'All other device sessions have been revoked' };
  }

  /**
   * 17. CHANGE PASSWORD
   */
  async changePassword({ userId, currentPassword, newPassword, currentSessionId, ip, userAgent }) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404);
    }

    // Verify current password with Supabase
    if (!env.SUPABASE_URL.includes('placeholder')) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (error || !data?.session) {
        throw new AppError(
          ERROR_CODES.INVALID_CREDENTIALS,
          'Your current password was entered incorrectly.',
          400
        );
      }

      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.supabaseUserId,
        { password: newPassword }
      );

      if (updateError) {
        throw new AppError(
          ERROR_CODES.INTERNAL_ERROR,
          `Failed to update password: ${updateError.message}`,
          500
        );
      }
    }

    // Revoke all other sessions (keep current session active)
    await Session.updateMany(
      {
        userId,
        _id: { $ne: currentSessionId },
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revokedReason: 'password_reset',
        },
      }
    );

    await AuthEvent.create({
      type: 'password_changed',
      userId,
      ip,
      userAgent,
    });

    await mailService.sendPasswordChangedNotice({
      to: user.email,
      userName: user.fullName,
    });

    return { message: 'Password updated successfully. Other devices have been signed out.' };
  }
}

export const authService = new AuthService();
