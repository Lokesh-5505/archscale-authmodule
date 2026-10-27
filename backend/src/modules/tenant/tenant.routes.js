import { Router } from 'express';
import {
  listSubscribersHandler,
  inviteSubscriberHandler,
  updateSubscriberStatusHandler,
  updateSubscriberRoleHandler,
  removeSubscriberHandler,
} from './tenant.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/requireTenant.js';
import { requireTenantAdmin } from '../../middleware/requireTenantAdmin.js';

const router = Router();

// Base protection: Must be authenticated and acting within a tenant context
router.use(authenticate);
router.use(requireTenant);

// Any subscriber (Admin, Manager, Executive) can view team roster
router.get('/subscribers', listSubscribersHandler);

// Only Tenant Admin can invite team members
router.post('/subscribers/invite', requireTenantAdmin, inviteSubscriberHandler);

// Only Tenant Admin can activate or deactivate subscribers in their tenant
router.patch('/subscribers/:tenantUserId/status', requireTenantAdmin, updateSubscriberStatusHandler);

// Only Tenant Admin can change subscriber role in their tenant
router.patch('/subscribers/:tenantUserId/role', requireTenantAdmin, updateSubscriberRoleHandler);

// Only Tenant Admin can remove a subscriber from their tenant
router.delete('/subscribers/:tenantUserId', requireTenantAdmin, removeSubscriberHandler);

export default router;
