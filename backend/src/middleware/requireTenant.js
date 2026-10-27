import { TenantUser, Tenant, Membership } from '../models/index.js';
import { AppError } from './AppError.js';
import { ERROR_CODES } from '../config/constants.js';

export async function requireTenant(req, res, next) {
  try {
    if (!req.auth || !req.auth.session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    // Super admin and admin bypass tenant membership checks
    if (req.auth.platformRole === 'super_admin' || req.auth.platformRole === 'admin') {
      return next();
    }

    const activeTenantUserId = req.auth.activeTenantUserId;
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
      status: 'active',
    });

    if (!tenantUser) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'You do not have access to this organization profile',
        403
      );
    }

    // Load Tenant
    const tenant = await Tenant.findById(tenantUser.tenantId);
    if (!tenant) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Associated tenant not found', 404);
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
