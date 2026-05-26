import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { OperationsV4Controller } from './controllers/operations-v4.controller';
import { OperationsV4Service } from './services/operations-v4.service';

const router = Router();
const controller = new OperationsV4Controller(new OperationsV4Service());

router.use(authenticateToken, requireTenantGuard);

// ── Canonical V4.1 read routes ────────────────────────────────────────────────
router.get('/',                requirePermission('operations.read'), controller.listOperations);
router.get('/timeline',        requirePermission('operations.read'), controller.getTimeline);
router.get('/summary',         requirePermission('operations.read'), controller.getSummary);
router.get('/tasks',           requirePermission('operations.read'), controller.listTasks);
router.get('/tasks/pending',   requirePermission('operations.read'), controller.getPendingTasks);
router.get('/by-domain',       requirePermission('operations.read'), controller.getByDomain);
router.get('/by-plate/:plateId',  requirePermission('operations.read'), controller.getByPlate);
router.get('/by-region/:regionId', requirePermission('operations.read'), controller.getByRegion);
router.get('/canonicalization-report', requirePermission('admin.access'), controller.getCanonicalizationReport);
router.get('/link-resolution-queue',   requirePermission('admin.access'), controller.getLinkResolutionQueue);

// ── Canonical V4.1 write routes ───────────────────────────────────────────────
router.post('/',               requirePermission('operations.create'), controller.createTask);
router.post('/tasks',          requirePermission('operations.create'), controller.createTask);
router.patch('/tasks/:id',     requirePermission('operations.update'), controller.updateTask);
router.patch('/tasks/:id/complete', requirePermission('operations.complete'), controller.completeTask);
router.patch('/tasks/:id/assign',   requirePermission('operations.assign'), controller.assignTask);
router.post('/events',              requirePermission('operations.create'), controller.createEvent);
router.post('/backfill-plate-links',                  requirePermission('admin.access'), controller.backfillPlateLinks);
router.post('/refresh-canonicalization-diagnostics',  requirePermission('admin.access'), controller.refreshCanonicalizationDiagnostics);

// ── Canonical V4.1 operation lifecycle ───────────────────────────────────────
// NOTE: /:id routes must come after all static named routes to avoid shadowing
router.post('/:id/start',    requirePermission('operations.update'), controller.startTask);
router.post('/:id/complete', requirePermission('operations.complete'), controller.completeTask);
router.post('/:id/cancel',   requirePermission('operations.update'), controller.cancelTask);
router.post('/:operationId/resolve-plate-link', requirePermission('admin.access'), controller.resolvePlateLink);
router.get('/:operationId/link-resolution-context', requirePermission('admin.access'), controller.getLinkResolutionContext);

// ── Single operation fetch — must be last ─────────────────────────────────────
router.get('/:id', requirePermission('operations.read'), controller.getById);

export default router;
