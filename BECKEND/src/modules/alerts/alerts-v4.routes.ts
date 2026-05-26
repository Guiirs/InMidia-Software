import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { AlertsV4Controller } from './controllers/alerts-v4.controller';
import { AlertsV4Service } from './services/alerts-v4.service';

const router = Router();
const controller = new AlertsV4Controller(new AlertsV4Service());

router.use(authenticateToken, requireTenantGuard);

router.get('/',          requirePermission('alerts.read'), controller.listAlerts);
router.get('/summary',   requirePermission('alerts.read'), controller.getSummary);
router.get('/critical',  requirePermission('alerts.read'), controller.getCritical);
router.get('/unread',    requirePermission('alerts.read'), controller.getUnread);
router.get('/by-domain', requirePermission('alerts.read'), controller.getByDomain);

router.patch('/read-all',      requirePermission('alerts.update'), controller.markAllRead);
router.patch('/:id/read',      requirePermission('alerts.update'), controller.markRead);
router.patch('/:id/dismiss',   requirePermission('alerts.dismiss'), controller.dismiss);
router.patch('/:id/resolve',   requirePermission('alerts.resolve'), controller.resolve);
router.post('/manual',         requirePermission('alerts.create'), controller.createManual);

export default router;
