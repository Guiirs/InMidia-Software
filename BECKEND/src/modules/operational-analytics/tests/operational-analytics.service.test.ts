import { dataQualityService } from '@modules/data-quality';
import { geoIntelligenceService } from '@modules/geo-intelligence';
import { governanceService } from '@modules/governance';
import type { ProjectionSnapshot } from '@modules/projections';
import { ProjectionService } from '@modules/projections';
import { OperationalAnalyticsSnapshotStore } from '../snapshots/operational-analytics.snapshot-store';
import { OperationalAnalyticsService } from '../services/operational-analytics.service';

const NOW = new Date('2026-05-18T12:00:00.000Z');

function buildProjectionSnapshot(): ProjectionSnapshot {
  const projectionService = new ProjectionService();
  const result = projectionService.buildProjectionSnapshot({
    inventorySources: [
      {
        placa: {
          _id: 'sat-1',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-saturada',
          numero_placa: 'SAT-001',
          numeroOperacional: 1,
          coordenadas: '-23.55052,-46.633308',
          disponivel: true,
        },
        alugueis: [{ id: 'aluguel-1', status: 'ativo', startDate: NOW.toISOString(), endDate: '2026-06-30T00:00:00.000Z' }],
      },
      {
        placa: {
          _id: 'sat-2',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-saturada',
          numero_placa: 'SAT-002',
          numeroOperacional: 2,
          coordenadas: '-23.55152,-46.634308',
          disponivel: true,
        },
        alugueis: [{ id: 'aluguel-2', status: 'ativo', startDate: NOW.toISOString(), endDate: '2026-06-30T00:00:00.000Z' }],
      },
      {
        placa: {
          _id: 'sat-3',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-saturada',
          numero_placa: 'SAT-003',
          numeroOperacional: 3,
          coordenadas: '-23.55252,-46.635308',
          disponivel: true,
        },
        alugueis: [{ id: 'aluguel-3', status: 'ativo', startDate: NOW.toISOString(), endDate: '2026-06-30T00:00:00.000Z' }],
      },
      {
        placa: {
          _id: 'sat-4',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-saturada',
          numero_placa: 'SAT-004',
          numeroOperacional: 4,
          coordenadas: '-23.55352,-46.636308',
          disponivel: true,
        },
        alugueis: [{ id: 'aluguel-4', status: 'ativo', startDate: NOW.toISOString(), endDate: '2026-06-30T00:00:00.000Z' }],
      },
      {
        placa: {
          _id: 'sat-5',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-saturada',
          numero_placa: 'SAT-005',
          numeroOperacional: 5,
          coordenadas: '-23.55452,-46.637308',
          disponivel: false,
        },
      },
      {
        placa: {
          _id: 'free-1',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-ociosa',
          numero_placa: 'FREE-001',
          numeroOperacional: 11,
          coordenadas: '-23.56052,-46.643308',
          disponivel: true,
        },
        alugueis: [{ id: 'aluguel-free-1', status: 'ativo', startDate: NOW.toISOString(), endDate: '2026-06-30T00:00:00.000Z' }],
      },
      {
        placa: {
          _id: 'free-2',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-ociosa',
          numero_placa: 'FREE-002',
          numeroOperacional: 12,
          coordenadas: '-23.56152,-46.644308',
          disponivel: true,
        },
      },
      {
        placa: {
          _id: 'free-3',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-ociosa',
          numero_placa: 'FREE-003',
          numeroOperacional: 13,
          coordenadas: '-23.56252,-46.645308',
          disponivel: true,
        },
      },
      {
        placa: {
          _id: 'free-4',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-ociosa',
          numero_placa: 'FREE-004',
          numeroOperacional: 14,
          coordenadas: '-23.56352,-46.646308',
          disponivel: true,
        },
      },
      {
        placa: {
          _id: 'free-5',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-ociosa',
          numero_placa: 'FREE-005',
          numeroOperacional: 15,
          coordenadas: '-23.56452,-46.647308',
          disponivel: true,
        },
      },
      {
        placa: {
          _id: 'mix-1',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-mista',
          numero_placa: 'MIX-001',
          numeroOperacional: 21,
          coordenadas: '-23.57052,-46.653308',
          disponivel: true,
        },
      },
      {
        placa: {
          _id: 'mix-2',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-mista',
          numero_placa: 'MIX-002',
          numeroOperacional: null,
          coordenadas: null,
          disponivel: true,
        },
        contratos: [{ id: 'contrato-1', status: 'ativo' }],
      },
    ],
  }, {
    tenantId: 'empresa-1',
    source: 'test',
    now: NOW,
  });

  if (!result.projection) {
    throw new Error('Projection snapshot was not built');
  }

  return result.projection;
}

function createContext() {
  const projectionSnapshot = buildProjectionSnapshot();
  const geoResult = geoIntelligenceService.buildGeoIntelligenceSnapshot({
    snapshot: projectionSnapshot,
    knownRegionIds: ['regiao-saturada', 'regiao-ociosa', 'regiao-mista', 'regiao-sem-cobertura'],
    now: NOW,
  });
  const qualitySnapshot = dataQualityService.buildQualitySnapshot({
    snapshot: projectionSnapshot,
    geoSnapshot: geoResult.snapshot,
    now: NOW,
  });
  const downgradedQuality = {
    ...qualitySnapshot,
    score: { ...qualitySnapshot.score, global: 72, media: 65, operational: 66 },
    summary: {
      ...qualitySnapshot.summary,
      degraded: true,
      totalIssues: Math.max(qualitySnapshot.summary.totalIssues, 3),
      bySeverity: {
        ...qualitySnapshot.summary.bySeverity,
        high: Math.max(qualitySnapshot.summary.bySeverity.high, 1),
      },
      highestSeverity: qualitySnapshot.summary.highestSeverity ?? 'high',
    },
  };
  const governanceResult = governanceService.buildGovernanceSnapshot({
    projectionSnapshot,
    dataQualitySnapshot: downgradedQuality,
    now: NOW,
  });

  if (!geoResult.snapshot || !governanceResult.snapshot) {
    throw new Error('Dependent snapshots were not built');
  }

  return {
    projectionSnapshot,
    geoSnapshot: geoResult.snapshot,
    qualitySnapshot: downgradedQuality,
    governanceSnapshot: governanceResult.snapshot,
    knownRegionIds: ['regiao-saturada', 'regiao-ociosa', 'regiao-mista', 'regiao-sem-cobertura'],
    generatedBy: 'test',
    now: NOW,
  };
}

describe('OperationalAnalyticsService', () => {
  it('calculates KPIs', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const snapshot = service.buildAnalyticsSnapshot(createContext());

    expect(snapshot.kpis.find((kpi) => kpi.key === 'total-placas')?.value).toBe(12);
    expect(snapshot.kpis.find((kpi) => kpi.key === 'regioes-saturadas')?.value).toBeGreaterThanOrEqual(1);
  });

  it('calculates occupancy metrics', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const metrics = service.calculateOccupancyMetrics(createContext());

    expect(metrics.occupied).toBeGreaterThan(0);
    expect(metrics.saturatedRegions).toContain('regiao-saturada');
  });

  it('calculates availability metrics', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const metrics = service.calculateAvailabilityMetrics(createContext());

    expect(metrics.available).toBeGreaterThan(0);
    expect(metrics.highAvailabilityRegionIds).toContain('regiao-ociosa');
  });

  it('calculates geo metrics', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const metrics = service.calculateGeoMetrics(createContext());

    expect(metrics.coveredRegions).toBeGreaterThan(0);
    expect(metrics.underutilizedRegions).toBeGreaterThanOrEqual(1);
  });

  it('calculates quality metrics', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const metrics = service.calculateQualityMetrics(createContext());

    expect(metrics.globalScore).toBe(72);
    expect(metrics.mediaScore).toBe(65);
    expect(metrics.degraded).toBe(true);
  });

  it('calculates governance metrics', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const metrics = service.calculateGovernanceMetrics(createContext());

    expect(metrics.decision).toBe('review');
    expect(metrics.requiresReview).toBe(true);
  });

  it('detects trends from snapshots', () => {
    const store = new OperationalAnalyticsSnapshotStore();
    const service = new OperationalAnalyticsService(store);
    const previous = service.buildOperationalAnalytics(createContext());
    const currentContext = createContext();
    const current = service.buildAnalyticsSnapshot({
      ...currentContext,
      qualitySnapshot: {
        ...currentContext.qualitySnapshot,
        score: { ...currentContext.qualitySnapshot.score, global: 60, media: 50 },
      },
    }, previous);

    const trends = service.detectOperationalTrends(current, previous);
    expect(trends.some((trend) => trend.key === 'quality.change')).toBe(true);
  });

  it('builds analytics snapshot', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const snapshot = service.buildAnalyticsSnapshot(createContext());

    expect(snapshot.summary.totalPlacas).toBe(12);
    expect(snapshot.metrics.length).toBeGreaterThan(0);
  });

  it('aggregates regions', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const snapshot = service.buildAnalyticsSnapshot(createContext());

    expect(snapshot.aggregations.byRegion['regiao-saturada']?.totalPlacas).toBe(5);
    expect(snapshot.aggregations.byRegion['regiao-ociosa']?.totalPlacas).toBe(5);
  });

  it('detects saturation', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const snapshot = service.buildAnalyticsSnapshot(createContext());

    expect(snapshot.regions.find((region) => region.regionId === 'regiao-saturada')?.saturated).toBe(true);
  });

  it('detects underutilization', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const snapshot = service.buildAnalyticsSnapshot(createContext());

    expect(snapshot.regions.find((region) => region.regionId === 'regiao-ociosa')?.underutilized).toBe(true);
  });

  it('emits analytics signals', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const snapshot = service.buildAnalyticsSnapshot(createContext());

    expect(snapshot.signals.map((signal) => signal.type)).toEqual(expect.arrayContaining([
      'analytics.quality.degraded',
      'analytics.region.saturated',
      'analytics.region.underutilized',
      'analytics.media.low',
      'analytics.governance.warning',
    ]));
  });

  it('is compatible with Projection Layer', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const context = createContext();
    const snapshot = service.buildOperationalAnalytics(context);

    expect(snapshot.sourceProjectionId).toBe(context.projectionSnapshot.metadata.projectionId);
  });

  it('is compatible with Geo Intelligence', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const context = createContext();
    const snapshot = service.buildOperationalAnalytics(context);

    expect(snapshot.summary.coveredRegions).toBe(context.geoSnapshot.coverage.coveredRegionIds.length);
  });

  it('is compatible with Data Quality', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const context = createContext();
    const snapshot = service.buildOperationalAnalytics(context);

    expect(snapshot.quality.globalScore).toBe(context.qualitySnapshot.score.global);
  });

  it('is compatible with Governance', () => {
    const service = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore());
    const context = createContext();
    const snapshot = service.buildOperationalAnalytics(context);

    expect(snapshot.governance.decision).toBe(context.governanceSnapshot.summary.decision);
  });
});