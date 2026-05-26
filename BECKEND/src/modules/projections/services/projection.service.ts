import crypto from 'crypto';
import logger from '@shared/container/logger';
import { realtimeService } from '@modules/realtime';
import { geoIntelligenceService } from '@modules/geo-intelligence';
import { dataQualityService } from '@modules/data-quality';
import { governanceService } from '@modules/governance';
import { operationalAnalyticsService } from '@modules/operational-analytics';
import { InventoryProjectionBuilder } from '../builders/inventory-projection.builder';
import { SpatialProjectionBuilder } from '../builders/spatial-projection.builder';
import { DashboardProjectionBuilder } from '../builders/dashboard-projection.builder';
import { projectionEmitter, ProjectionEmitter } from '../emitters/projection.emitter';
import { localProjectionStore, LocalProjectionStore } from '../stores/projection.store';
import type {
  DashboardProjection,
  InventoryProjection,
  ProjectionBuildInput,
  ProjectionBuildResult,
  ProjectionContext,
  ProjectionEvent,
  ProjectionEventType,
  ProjectionMetadata,
  ProjectionSnapshot,
  ProjectionType,
  SpatialProjection,
} from '../contracts/projection.contracts';

export class ProjectionService {
  constructor(
    private readonly store: LocalProjectionStore = localProjectionStore,
    private readonly emitter: ProjectionEmitter = projectionEmitter,
    private readonly inventoryBuilder = new InventoryProjectionBuilder(),
    private readonly spatialBuilder = new SpatialProjectionBuilder(),
    private readonly dashboardBuilder = new DashboardProjectionBuilder(),
  ) {}

  buildInventoryProjection(input: ProjectionBuildInput, context: ProjectionContext = {}): InventoryProjection {
    return this.inventoryBuilder.build(input, context);
  }

  buildSpatialProjection(inventoryProjection: InventoryProjection): SpatialProjection {
    return this.spatialBuilder.build(inventoryProjection);
  }

  buildDashboardProjection(
    inventoryProjection: InventoryProjection,
    spatialProjection: SpatialProjection,
  ): DashboardProjection {
    return this.dashboardBuilder.build(inventoryProjection, spatialProjection);
  }

  buildProjectionSnapshot(
    input: ProjectionBuildInput,
    context: ProjectionContext = {},
  ): ProjectionBuildResult<ProjectionSnapshot> {
    const startedAt = Date.now();
    const events: ProjectionEvent[] = [];

    try {
      const inventory = this.buildInventoryProjection(input, context);
      events.push(this.emitProjectionEvent('inventory.updated', 'inventory', context, {
        itemCount: inventory.items.length,
        conflicts: inventory.summary.conflicts,
      }));

      const spatial = this.buildSpatialProjection(inventory);
      events.push(this.emitProjectionEvent('spatial.updated', 'spatial', context, {
        validMapPoints: spatial.points.length,
        invalidMapPoints: spatial.invalidPointIds.length,
      }));

      const dashboard = this.buildDashboardProjection(inventory, spatial);
      events.push(this.emitProjectionEvent('dashboard.updated', 'dashboard', context, {
        totalPlacas: dashboard.totalPlacas,
        occupancyRate: dashboard.occupancyRate,
      }));

      const metadata = this.createMetadata('snapshot', context, startedAt, inventory.items.length, events);
      const snapshot: ProjectionSnapshot = {
        inventory,
        spatial,
        dashboard,
        metadata,
      };

      logger.info('[ProjectionLayer] Projection snapshot built', {
        tenantId: context.tenantId,
        itemCount: metadata.itemCount,
        durationMs: metadata.durationMs,
        partial: metadata.partial,
      });

      return { ok: true, projection: snapshot, metadata, events };
    } catch (error) {
      const metadata = this.createMetadata('snapshot', context, startedAt, input.inventorySources.length, events);
      const message = error instanceof Error ? error.message : String(error);

      logger.error('[ProjectionLayer] Projection snapshot failed', {
        tenantId: context.tenantId,
        error: message,
        durationMs: metadata.durationMs,
      });

      return { ok: false, metadata, events, error: message };
    }
  }

  rebuildProjection(
    input: ProjectionBuildInput,
    context: ProjectionContext = {},
  ): ProjectionBuildResult<ProjectionSnapshot> {
    const result = this.buildProjectionSnapshot(input, context);
    if (!result.ok || !result.projection) return result;

    const tenantKey = context.tenantId ?? 'global';
    const saved = this.store.save(result.projection, tenantKey);
    const rebuildEvent = this.emitProjectionEvent('projection.rebuilt', 'snapshot', context, {
      version: saved.metadata.version,
      itemCount: saved.metadata.itemCount,
      partial: saved.metadata.partial,
    });

    saved.metadata.events = [...saved.metadata.events, rebuildEvent];

    logger.info('[ProjectionLayer] Projection rebuilt', {
      tenantId: context.tenantId,
      version: saved.metadata.version,
      itemCount: saved.metadata.itemCount,
      durationMs: saved.metadata.durationMs,
    });

    const geoResult = geoIntelligenceService.buildGeoIntelligenceSnapshot({
      snapshot: saved,
      generatedBy: 'projection-layer',
      now: context.now,
    });

    if (!geoResult.ok) {
      logger.warn('[ProjectionLayer] Geo intelligence snapshot failed', {
        tenantId: context.tenantId,
        error: geoResult.error,
      });
    }

    const qualityResult = dataQualityService.analyzeDataQuality({
      snapshot: saved,
      geoSnapshot: geoResult.snapshot,
      realtimeEvents: saved.metadata.events,
      generatedBy: 'projection-layer',
      now: context.now,
    });

    if (!qualityResult.ok || qualityResult.snapshot?.summary.degraded) {
      logger.warn('[ProjectionLayer] Data quality requires attention', {
        tenantId: context.tenantId,
        score: qualityResult.snapshot?.score.global,
        issues: qualityResult.snapshot?.summary.totalIssues,
        error: qualityResult.error,
      });
    }

    if (qualityResult.snapshot) {
      const governanceResult = governanceService.buildGovernanceSnapshot({
        projectionSnapshot: saved,
        dataQualitySnapshot: qualityResult.snapshot,
        generatedBy: 'projection-layer',
        now: context.now,
      });

      if (!governanceResult.ok || governanceResult.snapshot?.summary.requiresReview) {
        logger.warn('[ProjectionLayer] Governance review recommended', {
          tenantId: context.tenantId,
          decision: governanceResult.snapshot?.summary.decision,
          violations: governanceResult.snapshot?.summary.totalViolations,
          error: governanceResult.error,
        });
      }

      try {
        const analyticsSnapshot = operationalAnalyticsService.buildOperationalAnalytics({
          projectionSnapshot: saved,
          geoSnapshot: geoResult.snapshot,
          qualitySnapshot: qualityResult.snapshot,
          governanceSnapshot: governanceResult.snapshot,
          generatedBy: 'projection-layer',
          now: context.now,
        });

        logger.info('[ProjectionLayer] Operational analytics snapshot built', {
          tenantId: context.tenantId,
          totalPlacas: analyticsSnapshot.summary.totalPlacas,
          occupancyRate: analyticsSnapshot.summary.occupancyRate,
          signals: analyticsSnapshot.signals.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('[ProjectionLayer] Operational analytics skipped', {
          tenantId: context.tenantId,
          error: message,
        });
      }
    }

    return {
      ok: true,
      projection: saved,
      metadata: saved.metadata,
      events: [...result.events, rebuildEvent],
    };
  }

  emitProjectionEvent(
    type: ProjectionEventType,
    projectionType: ProjectionType,
    context: ProjectionContext = {},
    payload?: Record<string, unknown>,
  ): ProjectionEvent {
    const event = this.emitter.emit(type, projectionType, context, payload);
    const realtimeOptions = {
      empresaId: context.tenantId,
      source: context.source ?? 'projection-layer',
      correlationId: context.correlationId,
      partial: !!context.partialSourceIds?.length,
    };

    if (type === 'inventory.updated') {
      realtimeService.broadcastInventoryUpdate({
        changedIds: context.partialSourceIds,
      }, realtimeOptions);
    } else if (type === 'spatial.updated') {
      realtimeService.broadcastSpatialUpdate({
        changedIds: context.partialSourceIds,
      }, realtimeOptions);
    } else if (type === 'dashboard.updated') {
      realtimeService.broadcastDashboardUpdate(payload ?? {}, realtimeOptions);
    } else {
      realtimeService.broadcastProjectionUpdate({
        projectionEvent: event,
        snapshotVersion: payload?.version as number | undefined,
        itemCount: payload?.itemCount as number | undefined,
      }, realtimeOptions);
    }

    return event;
  }

  getSnapshot(tenantId = 'global'): ProjectionSnapshot | null {
    return this.store.get(tenantId);
  }

  private createMetadata(
    projectionType: ProjectionType,
    context: ProjectionContext,
    startedAt: number,
    itemCount: number,
    events: ProjectionEvent[],
  ): ProjectionMetadata {
    return {
      projectionId: crypto.randomUUID(),
      projectionType,
      version: this.store.getVersion(context.tenantId ?? 'global'),
      tenantId: context.tenantId,
      source: context.source ?? 'projection-layer',
      builtAt: (context.now ?? new Date()).toISOString(),
      durationMs: Date.now() - startedAt,
      itemCount,
      partial: !!context.partialSourceIds?.length,
      events,
    };
  }
}

export const projectionService = new ProjectionService();
