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
  '/summary',
  requirePermission('contracts.read'),
  controller.getSummary.bind(controller),
);

router.get(
  '/list',
  requirePermission('contracts.read'),
  controller.listContracts.bind(controller),
);

router.get(
  '/active',
  requirePermission('contracts.read'),
  controller.listActive.bind(controller),
);

router.get(
  '/expiring',
  requirePermission('contracts.read'),
  controller.listExpiring.bind(controller),
);

router.get(
  '/timeline',
  requirePermission('contracts.read'),
  controller.listTimeline.bind(controller),
);

router.get(
  '/',
  requirePermission('contracts.read'),
  controller.listContracts.bind(controller),
);

router.get(
  '/board/:boardId',
  requirePermission('contracts.read'),
  controller.getContractsByBoard.bind(controller),
);

router.post(
  '/',
  requirePermission('contracts.create'),
  controller.createContract.bind(controller),
);

router.put(
  '/:id',
  requirePermission('contracts.update'),
  controller.updateContract.bind(controller),
);

router.patch(
  '/:id',
  requirePermission('contracts.update'),
  controller.updateContract.bind(controller),
);

router.patch(
  '/:id/status',
  requirePermission('contracts.update'),
  controller.changeStatus.bind(controller),
);

router.post(
  '/:id/cancel',
  requirePermission('contracts.cancel'),
  controller.cancelContract.bind(controller),
);

router.post(
  '/:id/renew',
  requirePermission('contracts.renew'),
  controller.renewContract.bind(controller),
);

export default router;
