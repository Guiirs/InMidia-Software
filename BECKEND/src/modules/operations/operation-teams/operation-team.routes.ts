import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { OperationTeamController } from './operation-team.controller';
import { OperationTeamService } from './operation-team.service';

const router = Router();
const controller = new OperationTeamController(new OperationTeamService());

router.use(authenticateToken, requireTenantGuard);

router.get('/',     requirePermission('operations.read'),   controller.list);
router.post('/',    requirePermission('operations.create'), controller.create);
router.put('/:id',  requirePermission('operations.update'), controller.update);
router.post('/:id/archive', requirePermission('operations.update'), controller.archive);

// Single fetch — must be last to avoid shadowing static routes
router.get('/:id', requirePermission('operations.read'), controller.getById);

export default router;
