import { Router } from 'express';
import authMiddleware from '@middlewares/auth.middleware';
import { requireTenantGuard } from '@middlewares/tenant-guard.middleware';
import { requirePermission } from '@middlewares/permissions.middleware';
import {
  getSnapshot,
  getExecutiveDataset,
  getRegionalDataset,
  getInventoryDataset,
  getQualityDataset,
  getGovernanceDataset,
} from './enterprise-bi.controller';

const router = Router();

// All BI endpoints require authentication + tenant isolation + admin access
router.use(authMiddleware, requireTenantGuard, requirePermission('admin.access'));

router.get('/snapshot', getSnapshot);
router.get('/datasets/executive', getExecutiveDataset);
router.get('/datasets/regional', getRegionalDataset);
router.get('/datasets/inventory', getInventoryDataset);
router.get('/datasets/quality', getQualityDataset);
router.get('/datasets/governance', getGovernanceDataset);

export default router;
