import { Router } from 'express';
import authMiddleware from '@middlewares/auth.middleware';
import { requirePermission } from '@middlewares/permissions.middleware';
import { requireTenantGuard } from '@middlewares/tenant-guard.middleware';
import { realtimeMetrics } from '@modules/realtime/realtime.metrics';
import { eventBus } from '@modules/realtime/event-bus.service';
import { realtimeSubscriberRegistry } from '@modules/realtime/subscribers/realtime-subscriber.registry';
import { getProjectionMetricsSnapshot } from '@shared/infra/monitoring/projection-metrics';
import { getDomainMetricsSnapshot } from '@shared/infra/monitoring/domain-metrics';
import { sloRegistry } from '@shared/infra/monitoring/slo-registry';
import { projectionCacheService } from '@shared/infra/cache';
import { operationalReadinessService } from '@modules/system/operational-readiness.service';

const router = Router();

router.get('/realtime', authMiddleware, requireTenantGuard, requirePermission('sync.diagnostics'), (_req, res) => {
  const realtime = realtimeMetrics.snapshot();
  const bus = eventBus.diagnostics();
  const subscribers = realtimeSubscriberRegistry.list();
  const now = Date.now();

  res.status(200).json({
    success: true,
    data: {
      realtime,
      eventBus: bus,
      subscribers: {
        active: subscribers.length,
        orphanCandidates: subscribers.filter((subscriber) => {
          const lastSeen = subscriber.lastHeartbeatAt ?? subscriber.connectedAt;
          return now - new Date(lastSeen).getTime() > 2 * 60_000;
        }).length,
        byChannel: subscribers.reduce<Record<string, number>>((acc, subscriber) => {
          subscriber.channels.forEach((channel) => {
            acc[channel] = (acc[channel] ?? 0) + 1;
          });
          return acc;
        }, {}),
      },
      checkedAt: new Date().toISOString(),
    },
  });
});

router.get('/metrics', authMiddleware, requireTenantGuard, requirePermission('sync.diagnostics'), (_req, res) => {
  const cacheStats = projectionCacheService.stats();

  res.status(200).json({
    success: true,
    data: {
      projections: getProjectionMetricsSnapshot(),
      domains: getDomainMetricsSnapshot(),
      cache: {
        mode: cacheStats.mode,
        size: cacheStats.size,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        redisAvailable: cacheStats.redisAvailable,
      },
      checkedAt: new Date().toISOString(),
    },
  });
});

router.get('/score', authMiddleware, requireTenantGuard, requirePermission('sync.diagnostics'), async (_req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: await operationalReadinessService.getOperationalScore(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/slo', authMiddleware, requireTenantGuard, requirePermission('sync.diagnostics'), (_req, res) => {
  const domainMetrics = getDomainMetricsSnapshot();
  const projectionMetrics = getProjectionMetricsSnapshot();
  const report = sloRegistry.evaluate(domainMetrics, projectionMetrics);

  res.status(200).json({
    success: true,
    data: {
      compliance: report,
      definitions: sloRegistry.getAll(),
      checkedAt: new Date().toISOString(),
    },
  });
});

export default router;
