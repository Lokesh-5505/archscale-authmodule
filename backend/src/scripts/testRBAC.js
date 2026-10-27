import assert from 'assert';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import {
  User,
  Organization,
  Tenant,
  Membership,
  TenantUser,
  Invitation,
} from '../models/index.js';
import { adminService } from '../modules/admin/admin.service.js';
import { tenantService } from '../modules/tenant/tenant.service.js';
import { authService } from '../modules/auth/auth.service.js';
import { requireTenantAdmin } from '../middleware/requireTenantAdmin.js';
import { requireTenant } from '../middleware/requireTenant.js';

async function runRBACTests() {
  console.log('====================================================');
  console.log(' ARCHSCALE SAAS RBAC & ACCESS CONTROL VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function testAssert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await connectDB();

    console.log('1. Setting up test data (Tenants, Admins, Managers, Executives)...');
    const timestamp = Date.now();

    // 1. Create Super Admin
    const superAdmin = await User.create({
      supabaseUserId: `test-sa-${timestamp}`,
      userId: `sa_${timestamp}`,
      email: `sa_${timestamp}@archscale.in`,
      fullName: 'Super Admin Test',
      platformRole: 'super_admin',
      status: 'active',
    });

    // 2. Create Organization & Tenant A
    const orgA = await Organization.create({ name: `Org A ${timestamp}` });
    const tenantA = await Tenant.create({
      organizationId: orgA._id,
      name: `Tenant A Workspace`,
      status: 'active',
    });

    // Tenant A Admin
    const adminUserA = await User.create({
      supabaseUserId: `test-admin-a-${timestamp}`,
      userId: `admin_a_${timestamp}`,
      email: `admin_a_${timestamp}@archscale.in`,
      fullName: 'Admin User A',
      status: 'active',
    });
    const tuAdminA = await TenantUser.create({
      userId: adminUserA._id,
      tenantId: tenantA._id,
      role: 'admin',
      status: 'active',
    });

    // Tenant A Manager
    const managerUserA = await User.create({
      supabaseUserId: `test-mgr-a-${timestamp}`,
      userId: `mgr_a_${timestamp}`,
      email: `mgr_a_${timestamp}@archscale.in`,
      fullName: 'Manager User A',
      status: 'active',
    });
    const tuManagerA = await TenantUser.create({
      userId: managerUserA._id,
      tenantId: tenantA._id,
      role: 'manager',
      status: 'active',
    });

    // Tenant A Executive
    const execUserA = await User.create({
      supabaseUserId: `test-exec-a-${timestamp}`,
      userId: `exec_a_${timestamp}`,
      email: `exec_a_${timestamp}@archscale.in`,
      fullName: 'Executive User A',
      status: 'active',
    });
    const tuExecA = await TenantUser.create({
      userId: execUserA._id,
      tenantId: tenantA._id,
      role: 'executive',
      status: 'active',
    });

    // 3. Create Organization & Tenant B (For cross-tenant boundary testing)
    const orgB = await Organization.create({ name: `Org B ${timestamp}` });
    const tenantB = await Tenant.create({
      organizationId: orgB._id,
      name: `Tenant B Workspace`,
      status: 'active',
    });

    const adminUserB = await User.create({
      supabaseUserId: `test-admin-b-${timestamp}`,
      userId: `admin_b_${timestamp}`,
      email: `admin_b_${timestamp}@archscale.in`,
      fullName: 'Admin User B',
      status: 'active',
    });
    const tuAdminB = await TenantUser.create({
      userId: adminUserB._id,
      tenantId: tenantB._id,
      role: 'admin',
      status: 'active',
    });

    console.log('   ✓ Test dataset provisioned.\n');

    // =========================================================================
    // 2. Super Admin Capabilities
    // =========================================================================
    console.log('2. Testing Super Admin Universal Access Controls:');

    // List all tenants
    const allTenants = await adminService.listAllTenants({ page: 1, limit: 10 });
    testAssert(allTenants.tenants.length >= 2, 'Super Admin lists all platform tenants');

    // Deactivate Tenant A
    const deactTenant = await adminService.updateTenantStatus({
      tenantId: tenantA._id,
      status: 'deactivated',
      reason: 'Platform billing suspension',
      updatedBy: superAdmin._id,
    });
    testAssert(deactTenant.tenant.status === 'deactivated', 'Super Admin successfully deactivates Tenant A');

    const updatedTenantA = await Tenant.findById(tenantA._id);
    testAssert(updatedTenantA.status === 'deactivated', 'Tenant A is persisted as deactivated');

    // Super Admin reactivates Tenant A
    await adminService.updateTenantStatus({
      tenantId: tenantA._id,
      status: 'active',
      updatedBy: superAdmin._id,
    });
    const reactivatedTenantA = await Tenant.findById(tenantA._id);
    testAssert(reactivatedTenantA.status === 'active', 'Super Admin successfully reactivates Tenant A');

    // Super Admin lists subscribers of Tenant A
    const subsA = await adminService.listTenantSubscribers({ tenantId: tenantA._id });
    testAssert(subsA.subscribers.length === 3, 'Super Admin lists all 3 subscribers of Tenant A');

    // Super Admin deactivates Executive in Tenant A
    const deactSub = await adminService.updateSubscriberStatus({
      subscriberId: tuExecA._id,
      status: 'inactive',
      reason: 'Security hold',
      updatedBy: superAdmin._id,
    });
    testAssert(deactSub.subscriber.status === 'inactive', 'Super Admin can deactivate any subscriber');

    // Reactivate Executive
    await adminService.updateSubscriberStatus({
      subscriberId: tuExecA._id,
      status: 'active',
      updatedBy: superAdmin._id,
    });
    const reactExec = await TenantUser.findById(tuExecA._id);
    testAssert(reactExec.status === 'active', 'Super Admin can reactivate any subscriber');

    // =========================================================================
    // 3. Subscriber-Side Tenant Admin Capabilities
    // =========================================================================
    console.log('\n3. Testing Tenant Admin Scoped Controls:');

    // Tenant Admin lists subscribers
    const tenantSubs = await tenantService.listSubscribers({ tenantId: tenantA._id });
    testAssert(tenantSubs.subscribers.length === 3, 'Tenant Admin lists subscribers in Tenant A');

    // Tenant Admin deactivates Executive in Tenant A
    const taDeact = await tenantService.updateSubscriberStatus({
      tenantId: tenantA._id,
      tenantUserId: tuExecA._id,
      status: 'inactive',
      updatedBy: adminUserA._id,
    });
    testAssert(taDeact.subscriber.status === 'inactive', 'Tenant Admin successfully deactivates subscriber in their tenant');

    // Tenant Admin reactivates Executive in Tenant A
    const taAct = await tenantService.updateSubscriberStatus({
      tenantId: tenantA._id,
      tenantUserId: tuExecA._id,
      status: 'active',
      updatedBy: adminUserA._id,
    });
    testAssert(taAct.subscriber.status === 'active', 'Tenant Admin successfully reactivates subscriber in their tenant');

    // Tenant Admin updates role from Executive to Manager
    const roleUp = await tenantService.updateSubscriberRole({
      tenantId: tenantA._id,
      tenantUserId: tuExecA._id,
      role: 'manager',
      updatedBy: adminUserA._id,
    });
    testAssert(roleUp.subscriber.role === 'manager', 'Tenant Admin updates subscriber role to manager');

    // Reset back to executive
    await tenantService.updateSubscriberRole({
      tenantId: tenantA._id,
      tenantUserId: tuExecA._id,
      role: 'executive',
      updatedBy: adminUserA._id,
    });

    // =========================================================================
    // 4. Strict Boundary & Authorization Checks
    // =========================================================================
    console.log('\n4. Testing Security Boundaries & Restrictions:');

    // 4.1 Tenant Admin A CANNOT deactivate a subscriber in Tenant B
    let crossTenantBlocked = false;
    try {
      await tenantService.updateSubscriberStatus({
        tenantId: tenantA._id,
        tenantUserId: tuAdminB._id, // User from Tenant B!
        status: 'inactive',
        updatedBy: adminUserA._id,
      });
    } catch (err) {
      crossTenantBlocked = true;
    }
    testAssert(crossTenantBlocked, 'Tenant Admin CANNOT deactivate subscriber belonging to another tenant');

    // 4.2 Tenant Admin CANNOT deactivate themselves if only active admin
    let selfDeactBlocked = false;
    try {
      await tenantService.updateSubscriberStatus({
        tenantId: tenantA._id,
        tenantUserId: tuAdminA._id,
        status: 'inactive',
        updatedBy: adminUserA._id,
      });
    } catch (err) {
      selfDeactBlocked = true;
    }
    testAssert(selfDeactBlocked, 'Tenant Admin CANNOT deactivate themselves if they are the sole admin');

    // 4.3 requireTenantAdmin middleware guard: Manager and Executive blocked
    let managerRejected = false;
    const mockReqMgr = {
      auth: {
        userId: managerUserA._id,
        platformRole: null,
        tenantUser: { role: 'manager' },
      },
    };
    requireTenantAdmin(mockReqMgr, {}, (err) => {
      if (err && err.statusCode === 403) managerRejected = true;
    });
    testAssert(managerRejected, 'requireTenantAdmin blocks Manager (403 FORBIDDEN)');

    let execRejected = false;
    const mockReqExec = {
      auth: {
        userId: execUserA._id,
        platformRole: null,
        tenantUser: { role: 'executive' },
      },
    };
    requireTenantAdmin(mockReqExec, {}, (err) => {
      if (err && err.statusCode === 403) execRejected = true;
    });
    testAssert(execRejected, 'requireTenantAdmin blocks Executive (403 FORBIDDEN)');

    let adminAllowed = false;
    const mockReqAdmin = {
      auth: {
        userId: adminUserA._id,
        platformRole: null,
        tenantUser: { role: 'admin' },
      },
    };
    requireTenantAdmin(mockReqAdmin, {}, (err) => {
      if (!err) adminAllowed = true;
    });
    testAssert(adminAllowed, 'requireTenantAdmin allows Admin');

    // 4.4 Enforce strictly one admin per tenant: promoting another subscriber to admin is BLOCKED
    let secondAdminRoleBlocked = false;
    try {
      await tenantService.updateSubscriberRole({
        tenantId: tenantA._id,
        tenantUserId: tuExecA._id,
        role: 'admin',
        updatedBy: adminUserA._id,
      });
    } catch (err) {
      if (err.statusCode === 409 || err.code === 'CONFLICT') secondAdminRoleBlocked = true;
    }
    testAssert(secondAdminRoleBlocked, 'Promoting another subscriber to Admin is BLOCKED (409 Conflict)');

    // 4.5 Enforce strictly one admin per tenant: inviting another admin to existing workspace is BLOCKED
    let secondAdminInviteBlocked = false;
    try {
      await tenantService.inviteSubscriber({
        tenantId: tenantA._id,
        email: `second_admin_${timestamp}@archscale.in`,
        role: 'admin',
        invitedBy: adminUserA._id,
      });
    } catch (err) {
      if (err.statusCode === 409 || err.code === 'CONFLICT') secondAdminInviteBlocked = true;
    }
    testAssert(secondAdminInviteBlocked, 'Inviting a second Admin to workspace is BLOCKED (409 Conflict)');

    // 4.6 Enforce strictly one admin per tenant: Mongoose schema level pre-save validation
    let schemaDuplicateBlocked = false;
    try {
      const extraAdminUser = await User.create({
        supabaseUserId: `extra-admin-${timestamp}`,
        userId: `extra_admin_${timestamp}`,
        email: `extra_admin_${timestamp}@archscale.in`,
        fullName: 'Extra Admin',
        status: 'active',
      });
      await TenantUser.create({
        userId: extraAdminUser._id,
        tenantId: tenantA._id,
        role: 'admin',
        status: 'active',
      });
    } catch (err) {
      if (err.statusCode === 409 || err.message.includes('already has an active Administrator')) {
        schemaDuplicateBlocked = true;
      }
    }
    testAssert(schemaDuplicateBlocked, 'Mongoose Schema pre-save blocks creating second active Admin in same tenant');

    // =========================================================================
    // 5. Context Normalization & Profile Switcher
    // =========================================================================
    console.log('\n5. Testing Profile Context & Role Normalization:');
    const contexts = await authService.getContexts(adminUserA._id);
    testAssert(contexts.length >= 1, 'getContexts returns profile contexts');
    testAssert(contexts[0].role === 'admin', 'getContexts normalizes role to "admin"');

    const execContexts = await authService.getContexts(execUserA._id);
    testAssert(execContexts[0].role === 'executive', 'getContexts normalizes role to "executive"');

    // Cleanup test data
    console.log('\nCleaning up test records...');
    await Promise.all([
      User.deleteMany({ _id: { $in: [superAdmin._id, adminUserA._id, managerUserA._id, execUserA._id, adminUserB._id] } }),
      Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } }),
      Organization.deleteMany({ _id: { $in: [orgA._id, orgB._id] } }),
      TenantUser.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
    ]);

    console.log(`\n====================================================`);
    console.log(` RBAC VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

runRBACTests();
