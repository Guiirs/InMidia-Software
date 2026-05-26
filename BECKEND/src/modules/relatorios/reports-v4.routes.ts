import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { ReportsV4Controller } from './controllers/reports-v4.controller';
import { ReportsV4Service } from './services/reports-v4.service';

const router = Router();
const controller = new ReportsV4Controller(new ReportsV4Service());

router.use(authenticateToken, requireTenantGuard);

router.get('/summary',    requirePermission('reports.read'), controller.getSummary);
router.get('/analytics',  requirePermission('reports.read'), controller.getAnalytics);
router.get('/exports',    requirePermission('reports.read'), controller.listExports);
router.get('/by-domain',  requirePermission('reports.read'), controller.getByDomain);
router.get('/by-period',  requirePermission('reports.read'), controller.getByPeriod);

router.post('/exports',              requirePermission('reports.export'), controller.createExport);
router.patch('/exports/:id/cancel',  requirePermission('reports.export'), controller.cancelExport);
router.post('/schedules',            requirePermission('reports.schedule'), controller.createSchedule);
router.patch('/schedules/:id',       requirePermission('reports.schedule'), controller.updateSchedule);
router.delete('/schedules/:id',      requirePermission('reports.schedule'), controller.deleteSchedule);

export default router;
