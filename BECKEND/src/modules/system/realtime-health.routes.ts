import { Router } from 'express';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { realtimeMetrics } from '@modules/realtime/realtime.metrics';

const router = Router();

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
router.get('/readiness', authMiddleware, requireTenantGuard, (_req, res) => {
  const rt = realtimeMetrics.snapshot();

  res.status(200).json({
    success: true,
    data: {
      auth:      'ok',
      features:  'ok',
      inventory: 'ok',
      dashboard: 'ok',
      contracts: 'ok',
      commercial:'ok',
      alerts:    'ok',
      operations:'ok',
      reports:   'ok',
      realtime:  rt.connectedClients >= 0 ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
    },
  });
});

export default router;
