import { AppError } from './AppError.js';
import { ERROR_CODES } from '../config/constants.js';

export function requireTenantAdmin(req, res, next) {
  if (!req.auth) {
    return next(new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401));
  }

  // Super admin has universal override
  if (req.auth.platformRole === 'super_admin') {
    return next();
  }

  const tenantUser = req.auth.tenantUser;
  if (!tenantUser) {
    return next(new AppError(ERROR_CODES.FORBIDDEN, 'Active tenant profile required', 403));
  }

  // Check if role is admin (or legacy owner/studio_owner)
  const role = tenantUser.role;
  const isAdmin = role === 'admin' || role === 'owner' || role === 'studio_owner';

  if (!isAdmin) {
    return next(
      new AppError(
        ERROR_CODES.FORBIDDEN,
        'Only a tenant administrator can manage subscribers or modify settings for this workspace',
        403
      )
    );
  }

  next();
}
