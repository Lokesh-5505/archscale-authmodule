import crypto from 'crypto';
import {
  Invitation,
  User,
  Organization,
  Tenant,
  Membership,
  TenantUser,
  AuthToken,
  AuthEvent,
  AuditEvent,
} from '../../models/index.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { generateToken, hashToken } from '../../services/token.service.js';
import { mailService } from '../../services/mail.service.js';
import { AppError } from '../../middleware/AppError.js';
import { ERROR_CODES, TOKEN_EXPIRY } from '../../config/constants.js';
import { env } from '../../config/env.js';

function resolveBaseUrl(frontendOrigin) {
  if (frontendOrigin && typeof frontendOrigin === 'string' && !frontendOrigin.includes('placeholder')) {
    return frontendOrigin.replace(/\/+$/, '');
  }
  return (env.FRONTEND_URL || 'https://archscale.in').replace(/\/+$/, '');
}

class AdminService {
  async createInvitation({
    email,
    tenantType,
    organizationName,
    membershipStartsAt,
    membershipEndsAt,
    mode = 'invite',
    prefill = {},
    invitedBy,
    frontendOrigin,
    ip,
    userAgent,
  }) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'A user with this email address already exists on ArchScale',
        409
      );
    }

    // 2. Check if a pending invite already exists
    const existingPending = await Invitation.findOne({
      email: normalizedEmail,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (existingPending) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'An active invitation has already been sent to this email address',
        409
      );
    }

    // 3. Generate token & hash
    const baseUrl = resolveBaseUrl(frontendOrigin);
    const rawToken = generateToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.INVITATION_HOURS * 60 * 60 * 1000);
    const inviteLink = `${baseUrl}/accept-invite?token=${rawToken}`;

    // 4. Create Invitation
    const invitation = await Invitation.create({
      email: normalizedEmail,
      tokenHash,
      inviteLink,
      tenantType: tenantType || 'studio_owner',
      organizationName: organizationName || prefill.organizationName || '',
      membershipStartsAt: membershipStartsAt ? new Date(membershipStartsAt) : new Date(),
      membershipEndsAt: new Date(membershipEndsAt),
      mode,
      prefill,
      status: 'pending',
      invitedBy,
      expiresAt,
    });

    // 5. Send invitation email
    const mailResult = await mailService.sendInvite({
      to: normalizedEmail,
      link: inviteLink,
      tenantType: invitation.tenantType,
      organizationName: invitation.organizationName,
      expiresAt: invitation.expiresAt,
    });

    const emailDelivery = {
      sent: mailResult?.success === true,
      provider: mailResult?.provider || 'none',
      error: mailResult?.error || null,
      recipient: normalizedEmail,
    };

    // 6. Record audit events
    await AuthEvent.create({
      type: 'invite_sent',
      userId: invitedBy,
      ip,
      userAgent,
      meta: { invitationId: invitation._id, email: normalizedEmail, emailDelivery },
    });

    await AuditEvent.create({
      actorUserId: invitedBy,
      action: 'invitation_created',
      result: 'success',
      metadata: { invitationId: invitation._id, email: normalizedEmail, emailDelivery },
    });

    return {
      invitation: {
        id: invitation._id,
        email: invitation.email,
        tenantType: invitation.tenantType,
        organizationName: invitation.organizationName,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        inviteLink,
      },
      inviteLink,
      expiresAt: invitation.expiresAt,
      token: rawToken,
      emailDelivery,
    };
  }

  async listInvitations({ page = 1, limit = 20, status }) {
    const query = {};
    if (status) {
      query.status = status;
    }

    const skip = (Math.max(1, page) - 1) * limit;

    const [invitations, total] = await Promise.all([
      Invitation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('invitedBy', 'fullName email userId')
        .lean(),
      Invitation.countDocuments(query),
    ]);

    const now = new Date();
    const formatted = invitations.map((inv) => {
      let currentStatus = inv.status;
      if (currentStatus === 'pending' && new Date(inv.expiresAt) < now) {
        currentStatus = 'expired';
      }
      return {
        id: inv._id,
        email: inv.email,
        tenantType: inv.tenantType,
        organizationName: inv.organizationName,
        mode: inv.mode,
        status: currentStatus,
        invitedBy: inv.invitedBy
          ? {
              fullName: inv.invitedBy.fullName,
              email: inv.invitedBy.email,
            }
          : null,
        membershipStartsAt: inv.membershipStartsAt,
        membershipEndsAt: inv.membershipEndsAt,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        createdAt: inv.createdAt,
        inviteLink: inv.inviteLink || null,
      };
    });

    return {
      invitations: formatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async resendInvitation(invitationId, invitedBy, ip, userAgent, frontendOrigin) {
    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Invitation not found', 404);
    }

    if (invitation.status === 'accepted') {
      throw new AppError(ERROR_CODES.CONFLICT, 'This invitation has already been accepted', 400);
    }

    if (invitation.status === 'cancelled') {
      throw new AppError(ERROR_CODES.CONFLICT, 'Cannot resend a cancelled invitation.', 400);
    }

    const baseUrl = resolveBaseUrl(frontendOrigin);
    const rawToken = generateToken(32);
    invitation.tokenHash = hashToken(rawToken);
    invitation.expiresAt = new Date(Date.now() + TOKEN_EXPIRY.INVITATION_HOURS * 60 * 60 * 1000);
    invitation.status = 'pending';
    const inviteLink = `${baseUrl}/accept-invite?token=${rawToken}`;
    invitation.inviteLink = inviteLink;
    await invitation.save();

    const mailResult = await mailService.sendInvite({
      to: invitation.email,
      link: inviteLink,
      tenantType: invitation.tenantType,
      organizationName: invitation.organizationName,
      expiresAt: invitation.expiresAt,
    });

    const emailDelivery = {
      sent: mailResult?.success === true,
      provider: mailResult?.provider || 'none',
      error: mailResult?.error || null,
      recipient: invitation.email,
    };

    await AuditEvent.create({
      actorUserId: invitedBy,
      action: 'invitation_resent',
      result: 'success',
      metadata: { invitationId: invitation._id, email: invitation.email, emailDelivery },
    });

    return {
      message: emailDelivery.sent
        ? `Invitation successfully resent to ${invitation.email}!`
        : `Invitation updated, but email could not be delivered (${emailDelivery.error || 'check mail settings'}). Direct link: ${inviteLink}`,
      id: invitation._id,
      expiresAt: invitation.expiresAt,
      inviteLink,
      token: rawToken,
      emailDelivery,
    };
  }

  async cancelInvitation(invitationId, cancelledBy, ip, userAgent) {
    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Invitation not found', 404);
    }

    if (invitation.status === 'accepted') {
      throw new AppError(ERROR_CODES.CONFLICT, 'Cannot cancel an accepted invitation', 400);
    }

    invitation.status = 'cancelled';
    await invitation.save();

    await AuditEvent.create({
      actorUserId: cancelledBy,
      action: 'invitation_revoked',
      result: 'success',
      metadata: { invitationId: invitation._id, email: invitation.email },
    });

    return {
      message: 'Invitation cancelled successfully',
      id: invitation._id,
      status: 'cancelled',
    };
  }

  async revokeInvitation(invitationId, cancelledBy, ip, userAgent) {
    return this.cancelInvitation(invitationId, cancelledBy, ip, userAgent);
  }

  /**
   * Manual user creation by Super Admin per §5.3
   */
  async manualCreateUser({
    email,
    userId,
    username,
    fullName,
    role = 'MEMBER',
    organizationId,
    tenantId,
    membershipEndsAt,
    createdBy,
    ip,
    userAgent,
  }) {
    const normalizedEmail = email.toLowerCase().trim();
    const finalUserId = (userId || username || normalizedEmail.split('@')[0]).trim();

    // Check existing
    const existing = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { userIdLower: finalUserId.toLowerCase() },
        { usernameLower: finalUserId.toLowerCase() },
      ],
    });

    if (existing) {
      throw new AppError(ERROR_CODES.CONFLICT, 'User with this email or username already exists', 409);
    }

    // Create Supabase User
    let supabaseUserId;
    if (!env.SUPABASE_URL.includes('placeholder')) {
      const { data: suData, error: suErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
      });
      if (suErr) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, suErr.message, 500);
      }
      supabaseUserId = suData.user.id;
    } else {
      supabaseUserId = crypto.randomUUID();
    }

    // Create User in MongoDB
    const platformRole = role === 'SUPER_ADMIN' ? 'super_admin' : role === 'ADMIN' ? 'admin' : null;

    const user = await User.create({
      supabaseUserId,
      userId: finalUserId,
      username: finalUserId,
      email: normalizedEmail,
      fullName,
      platformRole,
      status: 'active',
      emailVerifiedAt: new Date(),
    });

    // If organization and tenant specified, create membership
    let membership = null;
    if (organizationId && tenantId) {
      membership = await Membership.create({
        userId: user._id,
        organizationId,
        tenantId,
        role: role || 'MEMBER',
        status: 'active',
        startsAt: new Date(),
        endsAt: membershipEndsAt ? new Date(membershipEndsAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdBy,
      });

      const tenantUser = await TenantUser.create({
        userId: user._id,
        tenantId,
        role: 'owner',
        status: 'active',
      });

      user.lastContextId = tenantUser._id;
      await user.save();
    }

    // Generate single-use password setup token
    const rawToken = generateToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await AuthToken.create({
      userId: user._id,
      purpose: 'reset_password',
      tokenHash,
      expiresAt,
    });

    const setupLink = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    await mailService.sendResetPassword({
      to: normalizedEmail,
      link: setupLink,
      userName: fullName,
    });

    await AuditEvent.create({
      actorUserId: createdBy,
      targetUserId: user._id,
      organizationId: organizationId || null,
      tenantId: tenantId || null,
      action: 'user_manually_registered',
      result: 'success',
      metadata: { email: normalizedEmail, role },
    });

    return {
      message: 'User created successfully and password setup email dispatched.',
      user: {
        id: user._id,
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        platformRole: user.platformRole,
      },
      membershipId: membership?._id || null,
      ...(env.NODE_ENV !== 'production' && { setupLink, token: rawToken }),
    };
  }

  /**
   * Provision Organization & Tenant records per §4.3
   */
  async createOrganization({ name, tenantName = 'Primary Workspace', tenantType = 'studio_owner', createdBy }) {
    const organization = await Organization.create({
      name: name.trim(),
      status: 'active',
      createdByUserId: createdBy,
    });

    const tenant = await Tenant.create({
      organizationId: organization._id,
      name: tenantName.trim(),
      tenantType,
      status: 'active',
    });

    await AuditEvent.create({
      actorUserId: createdBy,
      organizationId: organization._id,
      tenantId: tenant._id,
      action: 'organization_provisioned',
      result: 'success',
      metadata: { organizationName: organization.name, tenantName: tenant.name },
    });

    return {
      organization: {
        id: organization._id,
        name: organization.name,
        status: organization.status,
        createdAt: organization.createdAt,
      },
      tenant: {
        id: tenant._id,
        organizationId: tenant.organizationId,
        name: tenant.name,
        tenantType: tenant.tenantType,
        status: tenant.status,
      },
    };
  }

  /**
   * List Memberships per §10
   */
  async listMemberships({ organizationId, tenantId, status, page = 1, limit = 20 }) {
    const query = {};
    if (organizationId) query.organizationId = organizationId;
    if (tenantId) query.tenantId = tenantId;
    if (status) query.status = status;

    const skip = (Math.max(1, page) - 1) * limit;

    const [memberships, total] = await Promise.all([
      Membership.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email userId')
        .populate('organizationId', 'name status')
        .populate('tenantId', 'name tenantType status')
        .lean(),
      Membership.countDocuments(query),
    ]);

    const now = new Date();
    const formatted = memberships.map((m) => {
      const effectiveEnd = m.expiresAt || m.endsAt;
      const isActive = m.status === 'active' && (!effectiveEnd || effectiveEnd >= now) && (!m.startsAt || m.startsAt <= now);
      return {
        id: m._id,
        user: m.userId ? { id: m.userId._id, fullName: m.userId.fullName, email: m.userId.email, userId: m.userId.userId } : null,
        organization: m.organizationId ? { id: m.organizationId._id, name: m.organizationId.name } : null,
        tenant: m.tenantId ? { id: m.tenantId._id, name: m.tenantId.name } : null,
        role: m.role,
        status: m.status,
        isActive,
        startsAt: m.startsAt,
        expiresAt: effectiveEnd,
      };
    });

    return {
      memberships: formatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update or revoke membership per §10
   */
  async updateMembership({ membershipId, status, expiresAt, endsAt, updatedBy }) {
    const membership = await Membership.findById(membershipId);
    if (!membership) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Membership record not found', 404);
    }

    if (status) membership.status = status;
    if (expiresAt) {
      membership.expiresAt = new Date(expiresAt);
      membership.endsAt = new Date(expiresAt);
    } else if (endsAt) {
      membership.endsAt = new Date(endsAt);
      membership.expiresAt = new Date(endsAt);
    }

    await membership.save();

    await AuditEvent.create({
      actorUserId: updatedBy,
      organizationId: membership.organizationId,
      tenantId: membership.tenantId,
      targetUserId: membership.userId,
      action: 'membership_updated',
      result: 'success',
      metadata: { membershipId: membership._id, status: membership.status },
    });

    return {
      message: 'Membership updated successfully',
      membership: {
        id: membership._id,
        status: membership.status,
        expiresAt: membership.expiresAt || membership.endsAt,
        isActive: membership.isActive(),
      },
    };
  }
}

export const adminService = new AdminService();
