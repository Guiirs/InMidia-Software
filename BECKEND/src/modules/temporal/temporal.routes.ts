import { Router } from 'express';
import { body, param, query } from 'express-validator';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { handleValidationErrors } from '@modules/auth/authValidator';
import { TemporalController } from './temporal.controller';

const router = Router();
const controller = new TemporalController();

router.use(authMiddleware, requireTenantGuard);

router.get(
  '/plates/:plateId/availability',
  requirePermission('placas.read'),
  param('plateId').isMongoId().withMessage('plateId invalido.'),
  query('startDate').optional().isISO8601().withMessage('startDate invalida.'),
  query('endDate').optional().isISO8601().withMessage('endDate invalida.'),
  query('dataInicio').optional().isISO8601().withMessage('dataInicio invalida.'),
  query('dataFim').optional().isISO8601().withMessage('dataFim invalida.'),
  handleValidationErrors,
  controller.getPlateAvailability,
);

router.post(
  '/check-availability',
  requirePermission('placas.read'),
  body('plateIds').optional().isArray().withMessage('plateIds deve ser uma lista.'),
  body('placas').optional().isArray().withMessage('placas deve ser uma lista.'),
  body('startDate').optional().isISO8601().withMessage('startDate invalida.'),
  body('endDate').optional().isISO8601().withMessage('endDate invalida.'),
  body('dataInicio').optional().isISO8601().withMessage('dataInicio invalida.'),
  body('dataFim').optional().isISO8601().withMessage('dataFim invalida.'),
  handleValidationErrors,
  controller.checkAvailability,
);

router.get(
  '/plates/:plateId/status',
  requirePermission('placas.read'),
  param('plateId').isMongoId().withMessage('plateId invalido.'),
  handleValidationErrors,
  controller.getPlateStatus,
);

router.get(
  '/dashboard-summary',
  requirePermission('dashboard.read'),
  controller.getDashboardSummary,
);

router.get(
  '/conflicts',
  requirePermission('dashboard.read'),
  controller.getConflicts,
);

router.post(
  '/backfill',
  requirePermission('admin.access'),
  controller.runBackfill,
);

router.get(
  '/backfill/status',
  requirePermission('admin.access'),
  controller.getBackfillStatus,
);

router.get(
  '/integrity-report',
  requirePermission('admin.access'),
  controller.getIntegrityReport,
);

router.get(
  '/scheduler/status',
  requirePermission('admin.access'),
  controller.getSchedulerStatus,
);

router.post(
  '/maintenance/daily',
  requirePermission('admin.access'),
  controller.runDailyMaintenance,
);

export default router;
