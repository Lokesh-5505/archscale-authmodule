import {
  TenantUser,
  Tenant,
  User,
  Invitation,
  AuditEvent,
  AuthEvent,
} from '../../models/index.js';
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

function normalizeRole(rawRole) {
  if (!rawRole) return 'executive';
  if (rawRole === 'owner' || rawRole === 'studio_owner' || rawRole === 'admin') return 'admin';
  if (rawRole === 'project_owner' || rawRole === 'manager') return 'manager';
  if (rawRole === 'vendor_owner' || rawRole === 'member' || rawRole === 'executive') return 'executive';
  return rawRole;
}

class TenantService {
  /**
   * List all subscribers belonging strictly to this tenant
   */
  async listSubscribers({ tenantId, page = 1, limit = 50 }) {
    const skip = (Math.max(1, page) - 1) * limit;

    const [subscribers, total] = await Promise.all([
      TenantUser.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email userId status initials')
        .populate('deactivatedBy', 'fullName email')
        .lean(),
      TenantUser.countDocuments({ tenantId }),
    ]);

    const formatted = subscribers.map((tu) => ({
      id: tu._id,
      tenantUserId: tu._id,
      user: tu.userId
        ? {
            id: tu.userId._id,
            fullName: tu.userId.fullName,
            email: tu.userId.email,
            userId: tu.userId.userId,
            status: tu.userId.status,
            initials: tu.userId.initials,
          }
        : null,
      role: normalizeRole(tu.role),
      rawRole: tu.role,
      status: tu.status,
      deactivatedAt: tu.deactivatedAt,
      deactivatedBy: tu.deactivatedBy ? { fullName: tu.deactivatedBy.fullName, email: tu.deactivatedBy.email } : null,
      deactivationReason: tu.deactivationReason || '',
      createdAt: tu.createdAt,
    }));

    return {
      subscribers: formatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Invite a new subscriber to this specific tenant (Tenant Admin only)
   */
  async inviteSubscriber({
    tenantId,
    email,
    role = 'executive',
    fullName = '',
    invitedBy,
    frontendOrigin,
    ip,
    userAgent,
  }) {
    const normalizedEmail = email.toLowerCase().trim();
    const effectiveRole = normalizeRole(role);

    // Verify tenant exists and is active
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Tenant workspace not found', 404);
    }
    if (tenant.status !== 'active') {
      throw new AppError(
        ERROR_CODES.TENANT_DEACTIVATED,
        'Cannot invite subscribers to a deactivated tenant workspace',
        400
      );
    }

    // Enforce strictly one admin per tenant
    if (effectiveRole === 'admin') {
      const existingAdmin = await TenantUser.findOne({
        tenantId,
        role: { $in: ['admin', 'owner', 'studio_owner'] },
        status: 'active',
      });
      if (existingAdmin) {
        throw new AppError(
          ERROR_CODES.CONFLICT,
          'This tenant workspace already has an active Administrator. Each workspace can only have one Admin.',
          409
        );
      }
    }

    // Check if user already exists and is already in this tenant
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const existingMembership = await TenantUser.findOne({
        tenantId,
        userId: existingUser._id,
      });

      if (existingMembership) {
        throw new AppError(
          ERROR_CODES.CONFLICT,
          'This user is already a member of this tenant workspace',
          409
        );
      }
    }

    // Check if pending invite already exists for this tenant & email
    const existingPending = await Invitation.findOne({
      tenantId,
      email: normalizedEmail,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (existingPending) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        'An active invitation has already been sent to this email address for this workspace',
        409
      );
    }

    // Generate token and link
    const baseUrl = resolveBaseUrl(frontendOrigin);
    const rawToken = generateToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.INVITATION_HOURS * 60 * 60 * 1000);
    const inviteLink = `${baseUrl}/accept-invite?token=${rawToken}`;

    const invitation = await Invitation.create({
      email: normalizedEmail,
      tokenHash,
      inviteLink,
      tenantId: tenant._id,
      tenantType: effectiveRole,
      role: effectiveRole,
      organizationName: tenant.name,
      membershipStartsAt: new Date(),
      membershipEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      prefill: { fullName },
      status: 'pending',
      invitedBy,
      expiresAt,
    });

    const mailResult = await mailService.sendInvite({
      to: normalizedEmail,
      link: inviteLink,
      tenantType: effectiveRole,
      organizationName: tenant.name,
      expiresAt: invitation.expiresAt,
    });

    const emailDelivery = {
      sent: mailResult?.success === true,
      provider: mailResult?.provider || 'none',
      error: mailResult?.error || null,
      recipient: normalizedEmail,
    };

    await AuditEvent.create({
      actorUserId: invitedBy,
      tenantId: tenant._id,
      action: 'tenant_subscriber_invited',
      result: 'success',
      metadata: { invitationId: invitation._id, email: normalizedEmail, role: effectiveRole },
    });

    return {
      message: emailDelivery.sent
        ? `Invitation successfully sent to ${normalizedEmail}.`
        : `Invitation created. Share direct link: ${inviteLink}`,
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        inviteLink,
      },
      emailDelivery,
    };
  }

  /**
   * Activate or Deactivate subscriber strictly in this tenant (Tenant Admin only)
   */
  async updateSubscriberStatus({ tenantId, tenantUserId, status, reason = '', updatedBy }) {
    if (status !== 'active' && status !== 'inactive') {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Status must be active or inactive', 400);
    }

    // Tenant boundary check: tenantId must match!
    const tenantUser = await TenantUser.findOne({
      _id: tenantUserId,
      tenantId,
    });

    if (!tenantUser) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        'Subscriber not found in this tenant workspace',
        404
      );
    }

    // Safety: prevent admin from deactivating themselves if they are the only admin
    if (tenantUser.userId.toString() === updatedBy.toString() && status === 'inactive') {
      const otherAdmins = await TenantUser.countDocuments({
        tenantId,
        role: { $in: ['admin', 'owner', 'studio_owner'] },
        status: 'active',
        _id: { $ne: tenantUser._id },
      });

      if (otherAdmins === 0) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          'Cannot deactivate yourself as you are the only active administrator in this workspace',
          400
        );
      }
    }

    tenantUser.status = status;
    if (status === 'inactive') {
      tenantUser.deactivatedAt = new Date();
      tenantUser.deactivatedBy = updatedBy;
      tenantUser.deactivationReason = reason;
    } else {
      tenantUser.deactivatedAt = null;
      tenantUser.deactivatedBy = null;
      tenantUser.deactivationReason = '';
    }

    await tenantUser.save();

    await AuditEvent.create({
      actorUserId: updatedBy,
      targetUserId: tenantUser.userId,
      tenantId,
      action: status === 'active' ? 'tenant_subscriber_activated' : 'tenant_subscriber_deactivated',
      result: 'success',
      metadata: { tenantUserId: tenantUser._id, status, reason },
    });

    return {
      message: `Subscriber access successfully ${status === 'active' ? 'activated' : 'deactivated'}.`,
      subscriber: {
        id: tenantUser._id,
        tenantUserId: tenantUser._id,
        status: tenantUser.status,
        deactivatedAt: tenantUser.deactivatedAt,
        deactivationReason: tenantUser.deactivationReason,
      },
    };
  }

  /**
   * Update subscriber role within this tenant (Tenant Admin only)
   */
  async updateSubscriberRole({ tenantId, tenantUserId, role, updatedBy }) {
    const validRoles = ['admin', 'manager', 'executive'];
    const targetRole = normalizeRole(role);

    if (!validRoles.includes(targetRole)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'Invalid role. Must be admin, manager, or executive.',
        400
      );
    }

    const tenantUser = await TenantUser.findOne({
      _id: tenantUserId,
      tenantId,
    });

    if (!tenantUser) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        'Subscriber not found in this tenant workspace',
        404
      );
    }

    // Enforce strictly one admin per tenant
    if (targetRole === 'admin') {
      const existingAdmin = await TenantUser.findOne({
        tenantId,
        role: { $in: ['admin', 'owner', 'studio_owner'] },
        status: 'active',
        _id: { $ne: tenantUser._id },
      });
      if (existingAdmin) {
        throw new AppError(
          ERROR_CODES.CONFLICT,
          'This workspace already has an active Administrator. Each tenant can only have one Admin.',
          409
        );
      }
    }

    tenantUser.role = targetRole;
    await tenantUser.save();

    await AuditEvent.create({
      actorUserId: updatedBy,
      targetUserId: tenantUser.userId,
      tenantId,
      action: 'tenant_subscriber_role_updated',
      result: 'success',
      metadata: { tenantUserId: tenantUser._id, newRole: targetRole },
    });

    return {
      message: 'Subscriber role updated successfully.',
      subscriber: {
        id: tenantUser._id,
        role: targetRole,
      },
    };
  }

  /**
   * Remove subscriber from tenant workspace (Tenant Admin only)
   */
  async removeSubscriber({ tenantId, tenantUserId, removedBy }) {
    const tenantUser = await TenantUser.findOne({
      _id: tenantUserId,
      tenantId,
    });

    if (!tenantUser) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        'Subscriber not found in this tenant workspace',
        404
      );
    }

    if (tenantUser.userId.toString() === removedBy.toString()) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'Cannot remove yourself from the tenant workspace',
        400
      );
    }

    await TenantUser.deleteOne({ _id: tenantUser._id });

    await AuditEvent.create({
      actorUserId: removedBy,
      targetUserId: tenantUser.userId,
      tenantId,
      action: 'tenant_subscriber_removed',
      result: 'success',
      metadata: { tenantUserId },
    });

    return {
      message: 'Subscriber removed from tenant workspace successfully.',
      id: tenantUserId,
    };
  }
}

export const tenantService = new TenantService();
