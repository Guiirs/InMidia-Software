import { Router } from 'express';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { InventorySummaryController } from './controllers/inventory-summary.controller';
import { InventorySummaryService } from './services/inventory-summary.service';
import { InventoryBoardsController } from './controllers/inventory-boards.controller';
import { InventoryBoardsService } from './services/inventory-boards.service';

const router = Router();
const summaryController = new InventorySummaryController(new InventorySummaryService());
const boardsController = new InventoryBoardsController(new InventoryBoardsService());

router.use(authMiddleware, requireTenantGuard);

router.get(
  '/summary',
  requirePermission('inventory.read'),
  summaryController.getSummary.bind(summaryController),
);

router.get(
  '/boards',
  requirePermission('inventory.read'),
  boardsController.listBoards.bind(boardsController),
);

router.get(
  '/regions',
  requirePermission('inventory.read'),
  boardsController.listRegions.bind(boardsController),
);

router.get(
  '/boards/:id',
  requirePermission('inventory.read'),
  boardsController.getBoard.bind(boardsController),
);

router.put(
  '/boards/:id',
  requirePermission('inventory.update'),
  boardsController.updateBoard.bind(boardsController),
);

router.patch(
  '/boards/:id',
  requirePermission('inventory.update'),
  boardsController.updateBoard.bind(boardsController),
);

router.patch(
  '/boards/:id/availability',
  requirePermission('inventory.update'),
  boardsController.toggleAvailability.bind(boardsController),
);

router.post(
  '/boards',
  requirePermission('inventory.create'),
  boardsController.createBoard.bind(boardsController),
);

router.delete(
  '/boards/:id',
  requirePermission('inventory.delete'),
  boardsController.deleteBoard.bind(boardsController),
);

export default router;
