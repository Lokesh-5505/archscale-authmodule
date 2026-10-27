import { adminService } from './admin.service.js';
import { getClientIp } from '../../services/ip.service.js';

export async function createInvitationHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

    const result = await adminService.createInvitation({
      ...req.body,
      invitedBy: req.auth.userId,
      frontendOrigin: origin,
      ip,
      userAgent,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listInvitationsHandler(req, res, next) {
  try {
    const { page, limit, status } = req.query;
    const result = await adminService.listInvitations({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function resendInvitationHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const { id } = req.params;
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

    const result = await adminService.resendInvitation(id, req.auth.userId, ip, userAgent, origin);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function cancelInvitationHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const { id } = req.params;

    const result = await adminService.cancelInvitation(id, req.auth.userId, ip, userAgent);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function manualCreateUserHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const result = await adminService.manualCreateUser({
      ...req.body,
      createdBy: req.auth.userId,
      ip,
      userAgent,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createOrganizationHandler(req, res, next) {
  try {
    const result = await adminService.createOrganization({
      ...req.body,
      createdBy: req.auth.userId,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listMembershipsHandler(req, res, next) {
  try {
    const { organizationId, tenantId, status, page, limit } = req.query;
    const result = await adminService.listMemberships({
      organizationId,
      tenantId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateMembershipHandler(req, res, next) {
  try {
    const { membershipId } = req.params;
    const result = await adminService.updateMembership({
      membershipId,
      ...req.body,
      updatedBy: req.auth.userId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
