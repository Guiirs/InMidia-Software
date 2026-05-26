import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { regionController } from './region.controller';

const router = Router();

router.use(authenticateToken);
router.use(requireTenantGuard);

router.post('/migrate-legacy', requirePermission('admin.access'), regionController.migrateLegacy);
router.get('/', requirePermission('regions.read'), regionController.listRegions);
router.post('/', requirePermission('regions.create'), regionController.createRegion);
router.get('/:id', requirePermission('regions.read'), regionController.getRegionById);
router.get('/:id/summary', requirePermission('regions.read'), regionController.getRegionSummary);
router.get('/:id/plates', requirePermission('regions.read'), regionController.getRegionPlates);
router.get('/:id/operations', requirePermission('regions.read'), regionController.getRegionOperations);
router.get('/:id/alerts', requirePermission('regions.read'), regionController.getRegionAlerts);
router.patch('/:id', requirePermission('regions.update'), regionController.updateRegion);
router.post('/:id/archive', requirePermission('regions.archive'), regionController.archiveRegion);
router.post('/:id/attach-plate', requirePermission('regions.manage'), regionController.attachPlate);
router.post('/:id/detach-plate', requirePermission('regions.manage'), regionController.detachPlate);

export default router;
