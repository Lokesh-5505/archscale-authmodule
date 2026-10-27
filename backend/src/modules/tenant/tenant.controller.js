import { tenantService } from './tenant.service.js';
import { getClientIp } from '../../services/ip.service.js';

export async function listSubscribersHandler(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await tenantService.listSubscribers({
      tenantId: req.auth.tenantId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function inviteSubscriberHandler(req, res, next) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

    const result = await tenantService.inviteSubscriber({
      ...req.body,
      tenantId: req.auth.tenantId,
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

export async function updateSubscriberStatusHandler(req, res, next) {
  try {
    const { tenantUserId } = req.params;
    const { status, reason } = req.body;

    const result = await tenantService.updateSubscriberStatus({
      tenantId: req.auth.tenantId,
      tenantUserId,
      status,
      reason,
      updatedBy: req.auth.userId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateSubscriberRoleHandler(req, res, next) {
  try {
    const { tenantUserId } = req.params;
    const { role } = req.body;

    const result = await tenantService.updateSubscriberRole({
      tenantId: req.auth.tenantId,
      tenantUserId,
      role,
      updatedBy: req.auth.userId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeSubscriberHandler(req, res, next) {
  try {
    const { tenantUserId } = req.params;

    const result = await tenantService.removeSubscriber({
      tenantId: req.auth.tenantId,
      tenantUserId,
      removedBy: req.auth.userId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
