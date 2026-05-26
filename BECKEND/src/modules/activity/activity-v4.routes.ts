import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { ActivityV4Controller } from './controllers/activity-v4.controller';
import { ActivityV4Service } from './services/activity-v4.service';

const router = Router();
const controller = new ActivityV4Controller(new ActivityV4Service());

router.use(authenticateToken, requireTenantGuard);

router.get('/timeline',   requirePermission('activity.read'), controller.getTimeline);
router.get('/feed',       requirePermission('activity.read'), controller.getFeed);
router.get('/audit',      requirePermission('activity.read'), controller.getAudit);
router.get('/by-domain',  requirePermission('activity.read'), controller.getByDomain);

router.post('/audit',     requirePermission('activity.write'), controller.createAuditEntry);

export default router;
