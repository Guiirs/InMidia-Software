import { Router } from 'express';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { realtimeMetrics } from '@modules/realtime/realtime.metrics';
import { operationalReadinessService } from './operational-readiness.service';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy' });
});

router.get('/realtime-health', authMiddleware, requireTenantGuard, (_req, res) => {
  res.status(200).json({
    success: true,
    data: realtimeMetrics.snapshot(),
  });
});

/**
 * GET /api/v4/system/readiness
 *
 * Verifica se os módulos V4 críticos estão acessíveis.
 * Usado pelo canário e pelo health check visual do frontend.
 * Não executa queries pesadas — apenas confirma que o gateway responde.
 */
router.get('/readiness', authMiddleware, requireTenantGuard, async (_req, res, next) => {
  try {
    const readiness = await operationalReadinessService.getReadiness();
    const legacy = {
      auth:       readiness.checks.api?.status === 'down' ? 'degraded' : 'ok',
      features:   'ok',
      inventory:  readiness.checks.projections?.status === 'down' ? 'degraded' : 'ok',
      dashboard:  readiness.checks.projections?.status === 'down' ? 'degraded' : 'ok',
      contracts:  readiness.checks.database?.status === 'down' ? 'degraded' : 'ok',
      commercial: readiness.checks.projections?.status === 'down' ? 'degraded' : 'ok',
      alerts:     readiness.checks.realtime?.status === 'down' ? 'degraded' : 'ok',
      operations: readiness.checks.scheduler?.status === 'down' ? 'degraded' : 'ok',
      reports:    readiness.checks.storage?.status === 'down' ? 'degraded' : 'ok',
      realtime:   readiness.checks.realtime?.status ?? 'degraded',
    };

    res.status(readiness.status === 'not_ready' ? 503 : 200).json({
      success: true,
      data: {
        ...legacy,
        status: readiness.status,
        checks: readiness.checks,
        checkedAt: readiness.checkedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
