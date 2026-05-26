import { Router } from 'express';
import { param } from 'express-validator';
import authMiddleware from '@middlewares/auth.middleware';
import { requireTenantGuard } from '@middlewares/tenant-guard.middleware';
import { requirePermission } from '@middlewares/permissions.middleware';
import { handleValidationErrors } from '@modules/auth/authValidator';
import {
  createExport,
  getExportProfiles,
  getExportStatus,
} from '../controllers/export.controller';

const router = Router();

// All export endpoints require authentication + tenant isolation + admin access
router.use(authMiddleware, requireTenantGuard, requirePermission('admin.access'));

/** POST /api/v1/exports — trigger an export build */
router.post('/', createExport);

/** GET /api/v1/exports/profiles — list available profiles + formats */
router.get('/profiles', getExportProfiles);

/** GET /api/v1/exports/:id/status — check export status from log */
router.get(
  '/:id/status',
  param('id').isLength({ min: 8, max: 100 }).withMessage('Export ID inválido'),
  handleValidationErrors,
  getExportStatus,
);

export default router;
