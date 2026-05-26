import crypto from 'crypto';
import logger from '@shared/container/logger';
import { enterpriseBiService } from '@modules/enterprise-bi';
import { OperationalKPICalculator } from '../calculators/operational-kpi.calculator';
import { RegionAnalyticsAggregator } from '../aggregators/region-analytics.aggregator';
import type {
  AnalyticsAvailabilitySummary,
  AnalyticsGovernanceSummary,
  AnalyticsMetric,
  AnalyticsOccupancySummary,
  AnalyticsQualitySummary,
  AnalyticsSignal,
  AnalyticsSnapshot,
  AnalyticsSummary,
  OperationalAnalyticsContext,
} from '../contracts/operational-analytics.contracts';
import { OperationalAnalyticsSnapshotStore, localOperationalAnalyticsSnapshotStore } from '../snapshots/operational-analytics.snapshot-store';
import { AnalyticsTrendDetector } from '../trend-analysis/analytics-trend.detector';

function average(values: number[]): number {
  return values.length > 0 ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class OperationalAnalyticsService {
  constructor(
    private readonly snapshotStore: OperationalAnalyticsSnapshotStore = localOperationalAnalyticsSnapshotStore,
    private readonly kpiCalculator = new OperationalKPICalculator(),
    private readonly regionAggregator = new RegionAnalyticsAggregator(),
    private readonly trendDetector = new AnalyticsTrendDetector(),
  ) {}

  buildOperationalAnalytics(context: OperationalAnalyticsContext): AnalyticsSnapshot {
    const tenantId = context.projectionSnapshot.metadata.tenantId ?? 'global';
    const previousSnapshot = this.snapshotStore.getLatest(tenantId);
    const snapshot = this.buildAnalyticsSnapshot(context, previousSnapshot);

    this.snapshotStore.save(snapshot, tenantId);

    logger.info('[OperationalAnalytics] Snapshot built', {
      tenantId: context.projectionSnapshot.metadata.tenantId,
      totalPlacas: snapshot.summary.totalPlacas,
      occupancyRate: snapshot.summary.occupancyRate,
      availabilityRate: snapshot.summary.availabilityRate,
      trends: snapshot.trends.length,
      signals: snapshot.signals.length,
    });

    const criticalSignals = snapshot.signals.filter((signal) => signal.severity === 'critical' || signal.severity === 'high');
    if (criticalSignals.length > 0) {
      logger.warn('[OperationalAnalytics] Elevated operational signals detected', {
        tenantId: context.projectionSnapshot.metadata.tenantId,
        signals: criticalSignals.map((signal) => signal.type),
      });
    }

    try {
      const biSnapshot = enterpriseBiService.buildBISnapshot({
        operationalAnalyticsSnapshot: snapshot,
        projectionSnapshot: context.projectionSnapshot,
        geoSnapshot: context.geoSnapshot,
        qualitySnapshot: context.qualitySnapshot,
        governanceSnapshot: context.governanceSnapshot,
        tenantId: context.projectionSnapshot.metadata.tenantId,
        empresaId: context.projectionSnapshot.metadata.tenantId,
        grain: 'global',
        profile: 'executive-summary',
        visibility: 'executive',
        generatedBy: 'operational-analytics',
        now: context.now,
      });

      logger.info('[OperationalAnalytics] Enterprise BI snapshot built', {
        tenantId: context.projectionSnapshot.metadata.tenantId,
        datasets: biSnapshot.summary.datasetCount,
        rows: biSnapshot.summary.rowCount,
        profile: biSnapshot.exportProfile,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('[OperationalAnalytics] Enterprise BI snapshot skipped', {
        tenantId: context.projectionSnapshot.metadata.tenantId,
        error: message,
      });
    }

    return snapshot;
  }

  calculateKPIs(input: {
    summary: AnalyticsSummary;
    occupancy: AnalyticsOccupancySummary;
    availability: AnalyticsAvailabilitySummary;
    quality: AnalyticsQualitySummary;
    governance: AnalyticsGovernanceSummary;
  }) {
    return this.kpiCalculator.calculate(input);
  }

  calculateOccupancyMetrics(context: OperationalAnalyticsContext, regions = this.regionAggregator.aggregate(context).regions): AnalyticsOccupancySummary {
    const summary = context.projectionSnapshot.inventory.summary;
    const totalPlacas = summary.total;
    const placasAtivas = context.projectionSnapshot.inventory.items.filter((item) => item.status.physical === 'active').length;

    return {
      totalPlacas,
      placasAtivas,
      occupied: summary.occupied,
      reserved: summary.reserved,
      available: summary.available,
      unavailable: summary.unavailable,
      unknown: summary.unknown,
      occupancyRate: totalPlacas > 0 ? Number(((summary.occupied / totalPlacas) * 100).toFixed(2)) : 0,
      saturatedRegions: regions.filter((region) => region.saturated).map((region) => region.regionId),
      underutilizedRegions: regions.filter((region) => region.underutilized).map((region) => region.regionId),
    };
  }

  calculateAvailabilityMetrics(context: OperationalAnalyticsContext, regions = this.regionAggregator.aggregate(context).regions): AnalyticsAvailabilitySummary {
    const summary = context.projectionSnapshot.inventory.summary;

    return {
      totalPlacas: summary.total,
      available: summary.available,
      unavailable: summary.unavailable,
      unknown: summary.unknown,
      availabilityRate: summary.total > 0 ? Number(((summary.available / summary.total) * 100).toFixed(2)) : 0,
      lowAvailabilityRegionIds: regions.filter((region) => region.availabilityRate <= 20 && region.totalPlacas > 0).map((region) => region.regionId),
      highAvailabilityRegionIds: regions.filter((region) => region.availabilityRate >= 60).map((region) => region.regionId),
    };
  }

  calculateGeoMetrics(context: OperationalAnalyticsContext, regions = this.regionAggregator.aggregate(context).regions): {
    metrics: AnalyticsMetric[];
    coveredRegions: number;
    saturatedRegions: number;
    underutilizedRegions: number;
    territorialQuality: number;
    operationalDensity: number;
  } {
    const coveredRegions = context.geoSnapshot?.coverage.coveredRegionIds.length
      ?? new Set(context.projectionSnapshot.inventory.items.map((item) => item.regiaoId).filter((value): value is string => !!value)).size;
    const saturatedRegions = regions.filter((region) => region.saturated).length;
    const underutilizedRegions = regions.filter((region) => region.underutilized).length;
    const territorialQuality = Number((average((context.geoSnapshot?.regionScores ?? []).map((region) => region.score)) || average(regions.map((region) => region.qualityScore))).toFixed(2));
    const densityValues = regions.filter((region) => region.totalPlacas > 0).map((region) => region.totalPlacas);
    const operationalDensity = Number((average(densityValues)).toFixed(2));

    return {
      metrics: [
        { key: 'territorial.covered-regions', label: 'Regioes cobertas', value: coveredRegions, unit: 'count', category: 'territorial' },
        { key: 'territorial.saturated-regions', label: 'Regioes saturadas', value: saturatedRegions, unit: 'count', category: 'territorial' },
        { key: 'territorial.underutilized-regions', label: 'Regioes subutilizadas', value: underutilizedRegions, unit: 'count', category: 'territorial' },
        { key: 'territorial.quality', label: 'Qualidade territorial', value: territorialQuality, unit: 'score', category: 'territorial' },
        { key: 'territorial.density', label: 'Densidade operacional', value: operationalDensity, unit: 'score', category: 'territorial' },
      ],
      coveredRegions,
      saturatedRegions,
      underutilizedRegions,
      territorialQuality,
      operationalDensity,
    };
  }

  calculateQualityMetrics(context: OperationalAnalyticsContext, regions = this.regionAggregator.aggregate(context).regions): AnalyticsQualitySummary {
    const quality = context.qualitySnapshot;

    return {
      globalScore: quality?.score.global ?? 100,
      geoScore: quality?.score.geo ?? (average(regions.map((region) => region.qualityScore)) || 100),
      inventoryScore: quality?.score.inventory ?? 100,
      mediaScore: quality?.score.media ?? 100,
      operationalScore: quality?.score.operational ?? 100,
      averageTerritorialQuality: Number((average(regions.map((region) => region.qualityScore))).toFixed(2)),
      totalIssues: quality?.summary.totalIssues ?? 0,
      degraded: quality?.summary.degraded ?? false,
      conflicts: context.projectionSnapshot.inventory.summary.conflicts,
    };
  }

  calculateGovernanceMetrics(context: OperationalAnalyticsContext): AnalyticsGovernanceSummary {
    const governance = context.governanceSnapshot;
    const averageScore = this.calculateGovernanceScore(governance);

    return {
      averageScore,
      decision: governance?.summary.decision ?? 'unknown',
      totalViolations: governance?.summary.totalViolations ?? 0,
      highestSeverity: governance?.summary.highestSeverity ?? null,
      requiresReview: governance?.summary.requiresReview ?? false,
      bySeverity: governance?.summary.bySeverity ?? { low: 0, medium: 0, high: 0, critical: 0 },
    };
  }

  detectOperationalTrends(currentSnapshot: AnalyticsSnapshot, previousSnapshot?: AnalyticsSnapshot) {
    return this.trendDetector.detect(currentSnapshot, previousSnapshot);
  }

  buildAnalyticsSnapshot(context: OperationalAnalyticsContext, previousSnapshot?: AnalyticsSnapshot): AnalyticsSnapshot {
    const now = context.now ?? new Date();
    const generatedAt = now.toISOString();
    const { regions, aggregations } = this.regionAggregator.aggregate(context);
    const occupancy = this.calculateOccupancyMetrics(context, regions);
    const availability = this.calculateAvailabilityMetrics(context, regions);
    const geo = this.calculateGeoMetrics(context, regions);
    const quality = this.calculateQualityMetrics(context, regions);
    const governance = this.calculateGovernanceMetrics(context);

    const metrics: AnalyticsMetric[] = [
      { key: 'inventory.total', label: 'Total de placas', value: occupancy.totalPlacas, unit: 'count', category: 'inventory' },
      { key: 'inventory.active', label: 'Placas ativas', value: occupancy.placasAtivas, unit: 'count', category: 'inventory' },
      { key: 'occupancy.rate', label: 'Ocupacao operacional', value: occupancy.occupancyRate, unit: 'percent', category: 'occupancy' },
      { key: 'availability.rate', label: 'Disponibilidade operacional', value: availability.availabilityRate, unit: 'percent', category: 'availability' },
      { key: 'quality.global', label: 'Score global de qualidade', value: quality.globalScore, unit: 'score', category: 'quality' },
      { key: 'quality.media', label: 'Score medio de midia', value: quality.mediaScore, unit: 'score', category: 'media' },
      { key: 'governance.score', label: 'Score medio de governanca', value: governance.averageScore, unit: 'score', category: 'governance' },
      ...geo.metrics,
    ];

    const summary: AnalyticsSummary = {
      totalPlacas: occupancy.totalPlacas,
      placasAtivas: occupancy.placasAtivas,
      occupancyRate: occupancy.occupancyRate,
      availabilityRate: availability.availabilityRate,
      coveredRegions: geo.coveredRegions,
      saturatedRegions: geo.saturatedRegions,
      underutilizedRegions: geo.underutilizedRegions,
      averageQuality: quality.globalScore,
      averageGovernance: governance.averageScore,
      territorialQuality: geo.territorialQuality,
      operationalDensity: geo.operationalDensity,
      totalSignals: 0,
    };

    const kpis = this.calculateKPIs({ summary, occupancy, availability, quality, governance });

    const draft: AnalyticsSnapshot = {
      id: crypto.randomUUID(),
      tenantId: context.projectionSnapshot.metadata.tenantId,
      generatedAt,
      sourceProjectionId: context.projectionSnapshot.metadata.projectionId,
      sourceProjectionVersion: context.projectionSnapshot.metadata.version,
      context: {
        generatedBy: context.generatedBy,
        knownRegions: context.knownRegionIds?.length ?? regions.length,
      },
      kpis,
      metrics,
      trends: [],
      signals: [],
      regions,
      occupancy,
      availability,
      quality,
      governance,
      summary,
      aggregations,
    };

    const trends = this.detectOperationalTrends(draft, previousSnapshot);
    const signals = this.buildSignals(draft, now);

    return {
      ...draft,
      trends,
      signals,
      summary: {
        ...draft.summary,
        totalSignals: signals.length,
      },
    };
  }

  private buildSignals(snapshot: AnalyticsSnapshot, now: Date): AnalyticsSignal[] {
    const emittedAt = now.toISOString();
    const signals: AnalyticsSignal[] = [];

    if (snapshot.occupancy.occupancyRate >= 80) {
      signals.push({
        id: `analytics:occupancy:${emittedAt}`,
        type: 'analytics.occupancy.high',
        severity: snapshot.occupancy.occupancyRate >= 90 ? 'critical' : 'high',
        message: 'Ocupacao operacional acima do limiar de atencao.',
        emittedAt,
        meta: { occupancyRate: snapshot.occupancy.occupancyRate },
      });
    }

    if (snapshot.quality.degraded || snapshot.quality.globalScore < 80) {
      signals.push({
        id: `analytics:quality:${emittedAt}`,
        type: 'analytics.quality.degraded',
        severity: snapshot.quality.globalScore < 70 ? 'high' : 'medium',
        message: 'Qualidade operacional degradada no snapshot atual.',
        emittedAt,
        meta: { score: snapshot.quality.globalScore, totalIssues: snapshot.quality.totalIssues },
      });
    }

    snapshot.regions.filter((region) => region.saturated).forEach((region) => {
      signals.push({
        id: `analytics:region:saturated:${region.regionId}:${emittedAt}`,
        type: 'analytics.region.saturated',
        severity: region.occupancyRate >= 90 ? 'high' : 'medium',
        message: 'Regiao com saturacao operacional elevada.',
        emittedAt,
        regionId: region.regionId,
        meta: { occupancyRate: region.occupancyRate, available: region.available },
      });
    });

    snapshot.regions.filter((region) => region.underutilized).forEach((region) => {
      signals.push({
        id: `analytics:region:underutilized:${region.regionId}:${emittedAt}`,
        type: 'analytics.region.underutilized',
        severity: region.available >= 3 ? 'medium' : 'low',
        message: 'Regiao com baixa ocupacao e estoque disponivel.',
        emittedAt,
        regionId: region.regionId,
        meta: { occupancyRate: region.occupancyRate, availabilityRate: region.availabilityRate },
      });
    });

    if (snapshot.quality.mediaScore < 70) {
      signals.push({
        id: `analytics:media:${emittedAt}`,
        type: 'analytics.media.low',
        severity: snapshot.quality.mediaScore < 50 ? 'high' : 'medium',
        message: 'Score medio de midia valida abaixo do esperado.',
        emittedAt,
        meta: { mediaScore: snapshot.quality.mediaScore },
      });
    }

    if (snapshot.governance.requiresReview || snapshot.governance.averageScore < 75) {
      signals.push({
        id: `analytics:governance:${emittedAt}`,
        type: 'analytics.governance.warning',
        severity: snapshot.governance.averageScore < 60 ? 'high' : 'medium',
        message: 'Governanca requer revisao operacional.',
        emittedAt,
        meta: { decision: snapshot.governance.decision, governanceScore: snapshot.governance.averageScore },
      });
    }

    return signals;
  }

  private calculateGovernanceScore(governance?: OperationalAnalyticsContext['governanceSnapshot']): number {
    if (!governance) return 100;

    const severityPenalty = governance.summary.bySeverity.low * 2
      + governance.summary.bySeverity.medium * 5
      + governance.summary.bySeverity.high * 15
      + governance.summary.bySeverity.critical * 30;
    const decisionPenalty = governance.summary.decision === 'deny'
      ? 50
      : governance.summary.decision === 'review'
        ? 25
        : governance.summary.decision === 'warn'
          ? 10
          : 0;

    return clamp(Math.round(100 - severityPenalty - decisionPenalty), 0, 100);
  }
}

export const operationalAnalyticsService = new OperationalAnalyticsService();