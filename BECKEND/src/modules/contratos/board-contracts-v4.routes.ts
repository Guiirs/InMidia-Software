import { Router } from 'express';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { OperationalContractController } from './controllers/operational-contract.controller';
import { OperationalContractService } from './services/operational-contract.service';

const router = Router();
const controller = new OperationalContractController(new OperationalContractService());

router.use(authMiddleware, requireTenantGuard);

router.get(
  '/:boardId/contracts',
  requirePermission('contracts.read'),
  controller.getContractsByBoard.bind(controller),
);

export default router;
