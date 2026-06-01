import { Router } from 'express';
import { param } from 'express-validator';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { handleValidationErrors } from '@modules/auth/authValidator';
import { CommercialProjectionController } from './commercial-projection.controller';

const router = Router();
const controller = new CommercialProjectionController();

router.use(authMiddleware, requireTenantGuard);

/**
 * GET /api/v4/commercial-projection/:placaId
 *
 * Resolves the canonical commercial projection for a single plate.
 * Protected by auth + tenant guard. Internal use only — not in Public API.
 */
router.get(
  '/:placaId',
  requirePermission('placas.read'),
  param('placaId').isMongoId().withMessage('placaId invalido.'),
  handleValidationErrors,
  controller.getByPlate,
);

export default router;
