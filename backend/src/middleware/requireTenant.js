import { TenantUser, Tenant, Membership } from '../models/index.js';
import { AppError } from './AppError.js';
import { ERROR_CODES } from '../config/constants.js';

export async function requireTenant(req, res, next) {
  try {
    if (!req.auth || !req.auth.session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    // Super admin bypasses tenant membership checks
    if (req.auth.platformRole === 'super_admin') {
      return next();
    }

    let activeTenantUserId = req.auth.activeTenantUserId;
    if (!activeTenantUserId) {
      // Auto-fallback 1: Check user's lastContextId
      if (req.auth.user?.lastContextId) {
        const lastTU = await TenantUser.findOne({
          _id: req.auth.user.lastContextId,
          userId: req.auth.userId,
          status: 'active',
        });
        if (lastTU) {
          activeTenantUserId = lastTU._id;
        }
      }

      // Auto-fallback 2: Automatically select user's first active tenant profile
      if (!activeTenantUserId) {
        const firstTU = await TenantUser.findOne({
          userId: req.auth.userId,
          status: 'active',
        });
        if (firstTU) {
          activeTenantUserId = firstTU._id;
        }
      }

      // Persist to session and req.auth so subsequent requests have it
      if (activeTenantUserId) {
        req.auth.activeTenantUserId = activeTenantUserId;
        if (req.auth.session) {
          req.auth.session.activeTenantUserId = activeTenantUserId;
          req.auth.session.save().catch(() => {});
        }
      }
    }

    if (!activeTenantUserId) {
      throw new AppError(
        ERROR_CODES.MEMBERSHIP_INACTIVE,
        'No active organization profile selected. Please choose a profile.',
        403
      );
    }

    // Load TenantUser
    const tenantUser = await TenantUser.findOne({
      _id: activeTenantUserId,
      userId: req.auth.userId,
    });

    if (!tenantUser) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'You do not have access to this organization profile',
        403
      );
    }

    if (tenantUser.status !== 'active') {
      throw new AppError(
        ERROR_CODES.SUBSCRIBER_INACTIVE,
        'Your access to this workspace is currently inactive. Please contact your administrator.',
        403
      );
    }

    // Load Tenant
    const tenant = await Tenant.findById(tenantUser.tenantId);
    if (!tenant) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Associated tenant not found', 404);
    }

    if (tenant.status === 'deactivated' || tenant.status === 'suspended') {
      throw new AppError(
        ERROR_CODES.TENANT_DEACTIVATED,
        'This workspace has been deactivated by the platform administrator.',
        403
      );
    }

    // Load Membership and verify isActive()
    const membership = await Membership.findOne({ tenantId: tenant._id });
    if (!membership || !membership.isActive()) {
      throw new AppError(
        ERROR_CODES.MEMBERSHIP_INACTIVE,
        'Your membership access period has concluded. Please contact your ArchScale administrator.',
        403
      );
    }

    // Attach verified tenant context to req.auth
    req.auth.tenantUser = tenantUser;
    req.auth.tenantId = tenant._id;
    req.auth.tenantType = tenant.tenantType;
    req.auth.membershipId = membership._id;

    next();
  } catch (err) {
    next(err);
  }
}
