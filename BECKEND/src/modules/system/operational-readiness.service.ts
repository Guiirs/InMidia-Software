import mongoose from 'mongoose';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { realtimeMetrics } from '@modules/realtime/realtime.metrics';
import { eventBus } from '@modules/realtime/event-bus.service';
import { getProjectionMetricsSnapshot } from '@shared/infra/monitoring/projection-metrics';
import { getDomainMetricsSnapshot } from '@shared/infra/monitoring/domain-metrics';
import { sloRegistry } from '@shared/infra/monitoring/slo-registry';
import { projectionCacheService } from '@shared/infra/cache';
import { redisManager } from '@shared/infra/redis/redis-manager';

export type OperationalCheckStatus = 'ok' | 'degraded' | 'down';
export type OperationalOverallStatus = 'ready' | 'degraded' | 'not_ready';
export type OperationalScoreStatus = 'healthy' | 'degraded' | 'critical';

export interface OperationalCheck {
  status: OperationalCheckStatus;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface OperationalReadinessSnapshot {
  status: OperationalOverallStatus;
  checks: Record<string, OperationalCheck>;
  checkedAt: string;
}

export interface OperationalScoreSnapshot {
  score: number;
  status: OperationalScoreStatus;
  readiness: OperationalReadinessSnapshot;
}

async function time<T>(fn: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const startedAt = Date.now();
  const value = await fn();
  return { value, latencyMs: Date.now() - startedAt };
}

function statusFromScore(score: number): OperationalScoreStatus {
  if (score >= 90) return 'healthy';
  if (score >= 70) return 'degraded';
  return 'critical';
}

function readinessFromChecks(checks: Record<string, OperationalCheck>): OperationalOverallStatus {
  const statuses = Object.values(checks).map((check) => check.status);
  if (statuses.some((status) => status === 'down')) return 'not_ready';
  if (statuses.some((status) => status === 'degraded')) return 'degraded';
  return 'ready';
}

export class OperationalReadinessService {
  async getReadiness(): Promise<OperationalReadinessSnapshot> {
    const checks: Record<string, OperationalCheck> = {};

    checks.database = await this.checkDatabase();
    checks.realtime = this.checkRealtime();
    checks.eventBus = this.checkEventBus();
    checks.scheduler = this.checkScheduler();
    checks.storage = await this.checkStorage();
    checks.projections = this.checkProjections();
    checks.cache = this.checkCache();
    checks.slo = this.checkSlo();
    checks.api = this.checkApi();

    return {
      status: readinessFromChecks(checks),
      checks,
      checkedAt: new Date().toISOString(),
    };
  }

  async getOperationalScore(): Promise<OperationalScoreSnapshot> {
    const readiness = await this.getReadiness();
    const weights: Record<string, number> = {
      database: 25,
      realtime: 10,
      eventBus: 10,
      scheduler: 5,
      storage: 5,
      projections: 15,
      cache: 10,
      slo: 10,
      api: 10,
    };

    const score = Object.entries(weights).reduce((sum, [key, weight]) => {
      const status = readiness.checks[key]?.status ?? 'down';
      if (status === 'ok') return sum + weight;
      if (status === 'degraded') return sum + Math.round(weight * 0.5);
      return sum;
    }, 0);

    return {
      score,
      status: statusFromScore(score),
      readiness,
    };
  }

  private async checkDatabase(): Promise<OperationalCheck> {
    try {
      const result = await time(async () => mongoose.connection.db?.admin().ping());
      const connected = mongoose.connection.readyState === 1;
      return {
        status: connected ? 'ok' : 'down',
        latencyMs: result.latencyMs,
        details: {
          readyState: mongoose.connection.readyState,
          name: mongoose.connection.name,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        details: {
          message: error instanceof Error ? error.message : 'database check failed',
          readyState: mongoose.connection.readyState,
        },
      };
    }
  }

  private checkRealtime(): OperationalCheck {
    const snapshot = realtimeMetrics.snapshot();
    const degraded = snapshot.authFailuresLastMinute > 20 || snapshot.activeListeners > 250;
    return {
      status: degraded ? 'degraded' : 'ok',
      details: {
        connectedClients: snapshot.connectedClients,
        activeListeners: snapshot.activeListeners,
        reconnectRate: snapshot.reconnectRate,
        authFailuresLastMinute: snapshot.authFailuresLastMinute,
      },
    };
  }

  private checkEventBus(): OperationalCheck {
    const diagnostics = eventBus.diagnostics();
    return {
      status: diagnostics.listenerCount > diagnostics.listenerWarnThreshold ? 'degraded' : 'ok',
      details: diagnostics,
    };
  }

  private checkScheduler(): OperationalCheck {
    return {
      status: 'ok',
      details: {
        mode: process.env.NODE_ENV === 'test' ? 'test' : 'process',
      },
    };
  }

  private async checkStorage(): Promise<OperationalCheck> {
    try {
      const result = await time(async () => fs.access(path.resolve(os.tmpdir())));
      return {
        status: 'ok',
        latencyMs: result.latencyMs,
        details: {
          mode: process.env.AWS_ACCESS_KEY_ID ? 's3' : 'local',
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        details: {
          message: error instanceof Error ? error.message : 'storage check failed',
        },
      };
    }
  }

  private checkProjections(): OperationalCheck {
    const snapshots = getProjectionMetricsSnapshot();
    const slow = snapshots.some((metric) => metric.maxMs > 1_000);
    return {
      status: slow ? 'degraded' : 'ok',
      details: {
        metrics: snapshots,
      },
    };
  }

  private checkCache(): OperationalCheck {
    const cacheStats = projectionCacheService.stats();
    const mode = cacheStats.mode;

    const redisEnabled = mode === 'redis';
    const redisState = redisManager.getState();

    let status: OperationalCheckStatus = 'ok';
    if (redisEnabled && redisState === 'degraded') {
      status = 'degraded';
    }

    return {
      status,
      details: {
        mode,
        size: cacheStats.size,
        hitRate: cacheStats.hitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        redis: {
          enabled: redisEnabled,
          state: redisEnabled ? redisState : 'disabled',
          available: cacheStats.redisAvailable,
        },
      },
    };
  }

  private checkSlo(): OperationalCheck {
    const domainMetrics = getDomainMetricsSnapshot();
    const projectionMetrics = getProjectionMetricsSnapshot();
    const report = sloRegistry.evaluate(domainMetrics, projectionMetrics);

    const status: OperationalCheckStatus =
      report.overall === 'compliant' ? 'ok' :
      report.overall === 'warning' ? 'degraded' :
      'degraded';

    return {
      status,
      details: {
        overall: report.overall,
        compliantCount: report.compliantCount,
        warningCount: report.warningCount,
        violatedCount: report.violatedCount,
      },
    };
  }

  private checkApi(): OperationalCheck {
    const metrics = getDomainMetricsSnapshot();
    const totalRequests = metrics.reduce((sum, metric) => sum + metric.requests, 0);
    const totalErrors = metrics.reduce((sum, metric) => sum + metric.errors, 0);
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    return {
      status: errorRate > 0.05 ? 'degraded' : 'ok',
      details: {
        totalRequests,
        totalErrors,
        errorRate: Number(errorRate.toFixed(4)),
      },
    };
  }
}

export const operationalReadinessService = new OperationalReadinessService();
