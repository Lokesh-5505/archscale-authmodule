import { Router } from 'express';
import {
  createInvitationHandler,
  listInvitationsHandler,
  resendInvitationHandler,
  cancelInvitationHandler,
  manualCreateUserHandler,
  createOrganizationHandler,
  listMembershipsHandler,
  updateMembershipHandler,
} from './admin.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createInvitationSchema,
  manualUserCreationSchema,
  createOrganizationSchema,
  updateMembershipSchema,
} from './admin.schemas.js';
import { PLATFORM_ROLES } from '../../config/constants.js';

const router = Router();

// Base authentication required for all admin endpoints
router.use(authenticate);

// ================= SUPER ADMIN ONLY ENDPOINTS =================
router.post(
  '/invitations',
  requireRole(PLATFORM_ROLES.SUPER_ADMIN),
  validate(createInvitationSchema),
  createInvitationHandler
);

router.get(
  '/invitations',
  requireRole(PLATFORM_ROLES.SUPER_ADMIN),
  listInvitationsHandler
);

router.post(
  '/invitations/:id/resend',
  requireRole(PLATFORM_ROLES.SUPER_ADMIN),
  resendInvitationHandler
);

router.post(
  '/invitations/:id/cancel',
  requireRole(PLATFORM_ROLES.SUPER_ADMIN),
  cancelInvitationHandler
);

router.post(
  '/invitations/:id/revoke',
  requireRole(PLATFORM_ROLES.SUPER_ADMIN),
  cancelInvitationHandler // Alias for revocation per §10
);

// Manual user creation per §5.3 & §10
router.post(
  '/users',
  requireRole(PLATFORM_ROLES.SUPER_ADMIN),
  validate(manualUserCreationSchema),
  manualCreateUserHandler
);

// Organization and Tenant provisioning per §4.3 & §10
router.post(
  '/organizations',
  requireRole(PLATFORM_ROLES.SUPER_ADMIN),
  validate(createOrganizationSchema),
  createOrganizationHandler
);

// ================= SUPER ADMIN & ADMIN PERMITTED ENDPOINTS =================
// List memberships within permitted scope per §10
router.get(
  '/memberships',
  requireRole(PLATFORM_ROLES.SUPER_ADMIN, PLATFORM_ROLES.ADMIN),
  listMembershipsHandler
);

// Activate, expire, or revoke membership per §10
router.patch(
  '/memberships/:membershipId',
  requireRole(PLATFORM_ROLES.SUPER_ADMIN, PLATFORM_ROLES.ADMIN),
  validate(updateMembershipSchema),
  updateMembershipHandler
);

export default router;
