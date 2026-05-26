import { dataQualityService } from '../services/data-quality.service';
import type { ProjectionSnapshot } from '@modules/projections';
import { mediaPipelineService } from '@modules/media';
import type { ProjectionEvent } from '@modules/projections';
import type { PublicInventoryItem } from '@modules/public-api';

const NOW = new Date('2026-05-18T12:00:00.000Z');

function baseSnapshot(overrides: Partial<ProjectionSnapshot> = {}): ProjectionSnapshot {
  const snapshot: ProjectionSnapshot = {
    inventory: {
      items: [
        {
          placaId: 'placa-1',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-1',
          numeroPlaca: 'OOH0001',
          numeroOperacional: 1,
          coordinates: { latitude: -23.55, longitude: -46.63 },
          status: { physical: 'active', commercial: 'available', operational: 'healthy' },
          availability: { status: 'available', available: true, reason: 'NO_ACTIVE_OPERATIONAL_LINK' },
          occupancy: { occupied: false, reserved: false, activeSourceIds: [], futureSourceIds: [] },
          conflicts: [],
        },
        {
          placaId: 'placa-2',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-1',
          numeroPlaca: 'OOH0002',
          numeroOperacional: 2,
          coordinates: { latitude: -23.56, longitude: -46.64 },
          status: { physical: 'active', commercial: 'occupied', operational: 'healthy' },
          availability: { status: 'occupied', available: false, reason: 'ACTIVE_RENTAL' },
          occupancy: { occupied: true, reserved: false, activeSourceIds: ['a1'], futureSourceIds: [] },
          conflicts: [],
        },
      ],
      summary: {
        total: 2,
        available: 1,
        reserved: 0,
        occupied: 1,
        unavailable: 0,
        unknown: 0,
        healthy: 2,
        attention: 0,
        conflicts: 0,
        incomplete: 0,
        diagnostics: [],
      },
    },
    spatial: {
      points: [
        { placaId: 'placa-1', empresaId: 'empresa-1', regiaoId: 'regiao-1', numeroOperacional: 1, coordinates: { latitude: -23.55, longitude: -46.63 } },
        { placaId: 'placa-2', empresaId: 'empresa-1', regiaoId: 'regiao-1', numeroOperacional: 2, coordinates: { latitude: -23.56, longitude: -46.64 } },
      ],
      invalidPointIds: [],
      groups: [{ key: 'regiao-1', count: 2, center: { latitude: -23.55, longitude: -46.63 } }],
      status: 'ready',
    },
    dashboard: {
      totalPlacas: 2,
      available: 1,
      reserved: 0,
      occupied: 1,
      unavailable: 0,
      unknown: 0,
      conflicts: 0,
      incomplete: 0,
      validMapPoints: 2,
      invalidMapPoints: 0,
      occupancyRate: 50,
    },
    metadata: {
      projectionId: 'projection-1',
      projectionType: 'snapshot',
      version: 1,
      tenantId: 'empresa-1',
      source: 'test',
      builtAt: NOW.toISOString(),
      durationMs: 1,
      itemCount: 2,
      partial: false,
      events: [],
    },
  };

  return {
    ...snapshot,
    ...overrides,
  };
}

describe('DataQualityService', () => {
  it('calcula score geo', () => {
    const score = dataQualityService.calculateQualityScore({ snapshot: baseSnapshot(), now: NOW });
    expect(score.geo).toBe(100);
  });

  it('calcula score inventory', () => {
    const score = dataQualityService.calculateQualityScore({ snapshot: baseSnapshot(), now: NOW });
    expect(score.inventory).toBe(100);
  });

  it('calcula score media', () => {
    const publicInventory: PublicInventoryItem[] = [{ id: 'p1', availability: { status: 'available', available: true, reason: 'test' }, status: { physical: 'active', commercial: 'available', operational: 'healthy' } }];
    const score = dataQualityService.calculateQualityScore({ snapshot: baseSnapshot(), publicInventory, now: NOW });
    expect(score.media).toBeLessThan(100);
  });

  it('analisa completeness', () => {
    const snapshot = baseSnapshot();
    snapshot.inventory.items[0] = { ...snapshot.inventory.items[0]!, coordinates: undefined, numeroOperacional: undefined };
    const result = dataQualityService.analyzeCompleteness({ snapshot, now: NOW });
    expect(result.missingCoordinates).toBe(1);
    expect(result.missingOperationalNumber).toBe(1);
  });

  it('analisa consistency', () => {
    const snapshot = baseSnapshot();
    snapshot.inventory.items[0] = {
      ...snapshot.inventory.items[0]!,
      status: { ...snapshot.inventory.items[0]!.status, commercial: 'occupied' },
    };
    const result = dataQualityService.analyzeConsistency({ snapshot, now: NOW });
    expect(result.availabilityMismatches).toBe(1);
  });

  it('analisa integrity', () => {
    const snapshot = baseSnapshot({ metadata: { ...baseSnapshot().metadata, source: '', itemCount: 99 } });
    const result = dataQualityService.analyzeIntegrity({ snapshot, now: NOW });
    expect(result.projectionsWithoutSource).toBe(1);
    expect(result.inconsistentSnapshots).toBe(1);
  });

  it('detecta issues', () => {
    const snapshot = baseSnapshot();
    snapshot.inventory.items[0] = { ...snapshot.inventory.items[0]!, regiaoId: undefined };
    const issues = dataQualityService.detectDataIssues({ snapshot, now: NOW });
    expect(issues.some((issue) => issue.code === 'MISSING_REGION')).toBe(true);
  });

  it('agrega severidade', () => {
    const summary = dataQualityService.buildQualitySummary([
      { id: 'i1', code: 'BROKEN_REFERENCE', category: 'structural', severity: 'critical', message: 'x' },
    ]);
    expect(summary.highestSeverity).toBe('critical');
    expect(summary.degraded).toBe(true);
  });

  it('gera snapshot quality', () => {
    const snapshot = dataQualityService.buildQualitySnapshot({ snapshot: baseSnapshot(), now: NOW });
    expect(snapshot.score.global).toBeGreaterThan(0);
    expect(snapshot.sourceProjectionId).toBe('projection-1');
  });

  it('detecta mismatch projection/inventory', () => {
    const snapshot = baseSnapshot({ dashboard: { ...baseSnapshot().dashboard, totalPlacas: 9 } });
    const consistency = dataQualityService.analyzeConsistency({ snapshot, now: NOW });
    expect(consistency.inventoryProjectionMismatches).toBe(1);
  });

  it('detecta midia invalida', () => {
    const invalid = mediaPipelineService.processMediaAsset('foto.exe', { now: NOW }).asset!;
    const consistency = dataQualityService.analyzeConsistency({ snapshot: baseSnapshot(), mediaAssets: [invalid], now: NOW });
    expect(consistency.invalidMedia).toBe(1);
  });

  it('detecta placa incompleta', () => {
    const snapshot = baseSnapshot();
    snapshot.inventory.items[0] = { ...snapshot.inventory.items[0]!, numeroPlaca: undefined };
    const completeness = dataQualityService.analyzeCompleteness({ snapshot, now: NOW });
    expect(completeness.missingRequiredData).toBe(1);
  });

  it('detecta evento realtime invalido', () => {
    const event = { id: '', type: 'projection.rebuilt', projectionType: 'snapshot', occurredAt: '', source: '' } as ProjectionEvent;
    const integrity = dataQualityService.analyzeIntegrity({ snapshot: baseSnapshot(), realtimeEvents: [event], now: NOW });
    expect(integrity.invalidRealtimeEvents).toBe(1);
  });

  it('mantem compatibilidade com Projection Layer', () => {
    const result = dataQualityService.analyzeDataQuality({ snapshot: baseSnapshot(), now: NOW });
    expect(result.ok).toBe(true);
  });

  it('mantem compatibilidade com Geo Intelligence', () => {
    const result = dataQualityService.analyzeConsistency({
      snapshot: baseSnapshot(),
      geoSnapshot: {
        coverage: { totalItems: 2, validCoordinateCount: 2, missingCoordinateCount: 0, coveredRegionIds: ['regiao-1'], uncoveredRegionIds: [], coveragePercent: 100, territorialCoveragePercent: 100, pointsOutsideRegionCount: 0, status: 'complete' },
        density: { mode: 'relative', regions: [], highConcentrationRegionIds: [], lowConcentrationRegionIds: [], concentrationIndex: 0, status: 'complete' },
        occupancy: [],
        availability: [],
        regionScores: [],
        opportunities: [],
        risks: [{ id: 'risk-1', type: 'operational-duplicates', severity: 'high', message: 'duplicado', regionId: 'regiao-1' }],
        generatedAt: NOW.toISOString(),
        sourceProjectionId: 'projection-1',
        sourceProjectionVersion: 1,
      },
      now: NOW,
    });
    expect(result.territorialConflicts).toBe(1);
  });

  it('mantem compatibilidade com Public API', () => {
    const publicInventory: PublicInventoryItem[] = [
      {
        id: 'OOH0001',
        availability: { status: 'available', available: true, reason: 'test' },
        status: { physical: 'active', commercial: 'available', operational: 'healthy' },
      },
    ];
    const snapshot = dataQualityService.buildQualitySnapshot({ snapshot: baseSnapshot(), publicInventory, now: NOW });
    expect(snapshot.summary.byCategory.media).toBeGreaterThan(0);
  });

  it('emite signals quando degradado', () => {
    const snapshot = baseSnapshot({
      spatial: { ...baseSnapshot().spatial, points: [], invalidPointIds: ['placa-1', 'placa-2'], status: 'partial' },
    });
    const quality = dataQualityService.buildQualitySnapshot({ snapshot, now: NOW });
    expect(quality.signals.some((signal) => signal.type === 'data-quality.degraded')).toBe(true);
    expect(quality.signals.some((signal) => signal.type === 'geo-quality.low')).toBe(true);
  });
});
