import { Router } from 'express';
import { param } from 'express-validator';
import authMiddleware from '@middlewares/auth.middleware';
import { requireTenantGuard } from '@middlewares/tenant-guard.middleware';
import { requirePermission } from '@middlewares/permissions.middleware';
import { handleValidationErrors } from '@modules/auth/authValidator';
import { getAuditLogById, getAuditLogsByEntity, listAuditLogs } from './audit.controller';

const router = Router();

router.use(authMiddleware, requireTenantGuard, requirePermission('audit.read'));

router.get('/', listAuditLogs);

router.get(
  '/entity/:entityType/:entityId',
  param('entityType').isLength({ min: 1, max: 80 }).withMessage('entityType invalido'),
  param('entityId').isLength({ min: 1, max: 120 }).withMessage('entityId invalido'),
  handleValidationErrors,
  getAuditLogsByEntity
);

router.get(
  '/:id',
  param('id').isMongoId().withMessage('ID de auditoria invalido'),
  handleValidationErrors,
  getAuditLogById
);

export default router;
