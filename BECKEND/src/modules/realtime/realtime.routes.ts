import { Router } from 'express';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import logger from '@shared/container/logger';
import { getRealtimeHealth, postOperationalStreamToken, streamOperationalEvents } from './realtime.controller';
import { realtimeMetrics } from './realtime.metrics';

const router = Router();

router.post('/stream-token', authMiddleware, requireTenantGuard, postOperationalStreamToken);
router.get('/stream', streamOperationalEvents);
router.get('/health', authMiddleware, getRealtimeHealth);

/* Log de diagnóstico SSE a cada 5 min — detecta listener leak antecipadamente */
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  const diagnosticsInterval = setInterval(() => {
    const snap = realtimeMetrics.snapshot();
    logger.info(
      `[RealtimeModule] health clients=${snap.connectedClients} listeners=${snap.activeListeners} ` +
      `emitted/min=${snap.emittedLastMinute} authFail/min=${snap.authFailuresLastMinute} ` +
      `heapMB=${Math.round(snap.memory.heapUsed / 1024 / 1024)} uptime=${snap.uptime}s`,
    );
  }, 5 * 60_000);
  diagnosticsInterval.unref?.();
}

export default router;
