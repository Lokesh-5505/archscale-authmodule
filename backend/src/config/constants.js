/**
 * Application Constants & Magic Numbers
 */

export const TOKEN_EXPIRY = {
  INVITATION_HOURS: 72,
  RESET_PASSWORD_HOURS: 1,
  VERIFY_EMAIL_HOURS: 24,
  ACCESS_TOKEN_SECONDS: 900, // 15 minutes
  OTP_MINUTES: 10,
};

export const SESSION_LIMITS = {
  // Keep me signed in = true
  REMEMBERED_MAX_AGE_DAYS: 30,
  REMEMBERED_IDLE_DAYS: 7,

  // Keep me signed in = false
  EPHEMERAL_MAX_AGE_HOURS: 12,
  EPHEMERAL_IDLE_HOURS: 2,

  // Activity update throttle
  ACTIVITY_UPDATE_INTERVAL_MINUTES: 5,
};

export const SECURITY_RULES = {
  MAX_FAILED_LOGINS_PER_ID: 5,
  MAX_FAILED_LOGINS_PER_IP: 20,
  LOCKOUT_DURATION_MINUTES: 15,
  MIN_PASSWORD_LENGTH: 10,
  USER_ID_REGEX: /^[a-zA-Z0-9_.]{3,30}$/,
};

export const PLATFORM_ROLES = {
  SUPER_ADMIN: 'super_admin',
};

export const SUBSCRIBER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EXECUTIVE: 'executive',
  // Backward compatibility aliases
  STUDIO_OWNER: 'studio_owner',
  PROJECT_OWNER: 'project_owner',
  VENDOR_OWNER: 'vendor_owner',
  OWNER: 'owner',
  MEMBER: 'member',
};

export const SUBSCRIBER_LABELS = {
  admin: 'Admin',
  manager: 'Manager / Coordinator',
  executive: 'Executive',
  studio_owner: 'Admin',
  project_owner: 'Manager / Coordinator',
  vendor_owner: 'Executive',
  owner: 'Admin',
  member: 'Executive',
};

export const TENANT_STATUSES = {
  ACTIVE: 'active',
  DEACTIVATED: 'deactivated',
  SUSPENDED: 'suspended',
};

export const SUBSCRIBER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

export const TENANT_TYPES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EXECUTIVE: 'executive',
  PROJECT_OWNER: 'project_owner',
  STUDIO_OWNER: 'studio_owner',
  VENDOR_OWNER: 'vendor_owner',
};

export const TENANT_LABELS = {
  admin: 'Admin',
  manager: 'Manager / Coordinator',
  executive: 'Executive',
  [TENANT_TYPES.PROJECT_OWNER]: 'Manager / Coordinator',
  [TENANT_TYPES.STUDIO_OWNER]: 'Admin',
  [TENANT_TYPES.VENDOR_OWNER]: 'Executive',
};

export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  MEMBERSHIP_INACTIVE: 'MEMBERSHIP_INACTIVE',
  TENANT_DEACTIVATED: 'TENANT_DEACTIVATED',
  SUBSCRIBER_INACTIVE: 'SUBSCRIBER_INACTIVE',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  LINK_INVALID: 'LINK_INVALID',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// Common/weak passwords blocklist
export const COMMON_PASSWORDS = new Set([
  'password', 'password123', '1234567890', '123456789', 'archscale123',
  'admin12345', 'qwertyuiop', 'welcome123', 'changeme123', 'iloveyou123',
  'letmein123', 'secret1234', 'monkey1234', 'dragon1234', 'master1234'
]);
