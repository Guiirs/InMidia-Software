import { Router } from 'express';
import { body } from 'express-validator';
import authMiddleware from '@middlewares/auth.middleware';
import { requireTenantGuard } from '@middlewares/tenant-guard.middleware';
import { requirePermission } from '@middlewares/permissions.middleware';
import { handleValidationErrors } from '@modules/auth/authValidator';
import {
  activateCapability,
  deactivateCapability,
  getMarketplaceCapabilities,
  getMarketplaceModules,
} from '../controllers/marketplace.controller';

const router = Router();

router.use(authMiddleware, requireTenantGuard, requirePermission('admin.access'));

router.get('/modules', getMarketplaceModules);
router.get('/capabilities', getMarketplaceCapabilities);
router.post(
  '/activate',
  body('capabilityId').isString().isLength({ min: 3, max: 120 }).withMessage('capabilityId inválido'),
  handleValidationErrors,
  activateCapability,
);
router.post(
  '/deactivate',
  body('capabilityId').isString().isLength({ min: 3, max: 120 }).withMessage('capabilityId inválido'),
  handleValidationErrors,
  deactivateCapability,
);

export default router;
