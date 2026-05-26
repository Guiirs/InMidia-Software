import { governanceService } from '../services/governance.service';
import type { DataQualitySnapshot } from '@modules/data-quality';
import type { ProjectionSnapshot } from '@modules/projections';
import type { PublicApiUsageLog, PublicInventoryItem } from '@modules/public-api';

const NOW = new Date('2026-05-18T12:00:00.000Z');

function publicItem(overrides: Partial<PublicInventoryItem> = {}): PublicInventoryItem {
  return {
    id: 'OOH0001',
    boardNumber: 'OOH0001',
    operationalNumber: 1,
    region: { id: 'regiao-1', name: 'Centro' },
    location: { street: 'Rua A', geo: { latitude: -23.55, longitude: -46.63, precision: 'exact' } },
    availability: { status: 'available', available: true, reason: 'NO_ACTIVE_OPERATIONAL_LINK' },
    status: { physical: 'active', commercial: 'available', operational: 'healthy' },
    media: { id: 'media-1', status: 'processed', filename: 'placa.jpg', variants: [{ type: 'thumbnail', planned: true }] },
    ...overrides,
  };
}

function quality(overrides: Partial<DataQualitySnapshot> = {}): DataQualitySnapshot {
  return {
    score: { global: 92, geo: 95, inventory: 90, media: 90, operational: 93 },
    completeness: {} as DataQualitySnapshot['completeness'],
    consistency: {} as DataQualitySnapshot['consistency'],
    integrity: {} as DataQualitySnapshot['integrity'],
    issues: [],
    signals: [],
    summary: {
      totalIssues: 0,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byCategory: { geo: 0, inventory: 0, media: 0, operational: 0, structural: 0, availability: 0, territorial: 0, consistency: 0 },
      degraded: false,
      highestSeverity: null,
    },
    generatedAt: NOW.toISOString(),
    sourceProjectionId: 'projection-1',
    sourceProjectionVersion: 1,
    ...overrides,
  };
}

function projection(overrides: Partial<ProjectionSnapshot> = {}): ProjectionSnapshot {
  return {
    inventory: { items: [], summary: { total: 0, available: 0, reserved: 0, occupied: 0, unavailable: 0, unknown: 0, healthy: 0, attention: 0, conflicts: 0, incomplete: 0, diagnostics: [] } },
    spatial: { points: [], invalidPointIds: [], groups: [], status: 'empty' },
    dashboard: { totalPlacas: 0, available: 0, reserved: 0, occupied: 0, unavailable: 0, unknown: 0, conflicts: 0, incomplete: 0, validMapPoints: 0, invalidMapPoints: 0, occupancyRate: 0 },
    metadata: { projectionId: 'projection-1', projectionType: 'snapshot', version: 1, source: 'test', builtAt: NOW.toISOString(), durationMs: 1, itemCount: 0, partial: false, events: [] },
    ...overrides,
  };
}

describe('GovernanceService', () => {
  it('exposure allow', () => {
    const result = governanceService.evaluateExposurePolicy({ publicItem: publicItem(), now: NOW });
    expect(result.decisions.some((decision) => decision.decision === 'allow')).toBe(true);
  });

  it('exposure warn', () => {
    const result = governanceService.evaluateExposurePolicy({ publicItem: publicItem({ media: undefined }), now: NOW });
    expect(result.decisions.some((decision) => decision.decision === 'warn')).toBe(true);
  });

  it('exposure review', () => {
    const result = governanceService.evaluateExposurePolicy({ publicItem: publicItem({ location: { street: 'Rua A' } }), now: NOW });
    expect(result.decisions.some((decision) => decision.decision === 'review')).toBe(true);
  });

  it('exposure deny teorico para campo sensivel', () => {
    const result = governanceService.evaluateExposurePolicy({ publicItem: publicItem(), sensitiveFields: ['_id'], now: NOW });
    expect(result.decisions.some((decision) => decision.decision === 'deny')).toBe(true);
  });

  it('quality policy com score baixo', () => {
    const low = quality({ score: { global: 60, geo: 60, inventory: 60, media: 60, operational: 60 } });
    const result = governanceService.evaluateQualityPolicy({ dataQualitySnapshot: low, now: NOW });
    expect(result.decisions.some((decision) => decision.decision === 'review')).toBe(true);
  });

  it('lifecycle draft', () => {
    const result = governanceService.evaluateLifecycleState({ publicItem: publicItem({ operationalNumber: undefined }), now: NOW });
    expect(result.state).toBe('draft');
  });

  it('lifecycle active', () => {
    const result = governanceService.evaluateLifecycleState({ publicItem: publicItem(), now: NOW });
    expect(result.state).toBe('active');
  });

  it('lifecycle archived', () => {
    const result = governanceService.evaluateLifecycleState({ publicItem: publicItem({ status: { physical: 'removed', commercial: 'unavailable', operational: 'unknown' } }), now: NOW });
    expect(result.state).toBe('archived');
  });

  it('retention recommendation', () => {
    const result = governanceService.evaluateRetentionPolicy({ now: NOW });
    expect(result.decisions[0]?.meta?.recommendations).toBeDefined();
  });

  it('violation critical', () => {
    const critical = quality({
      summary: {
        ...quality().summary,
        totalIssues: 1,
        bySeverity: { low: 0, medium: 0, high: 0, critical: 1 },
        highestSeverity: 'critical',
        degraded: true,
      },
    });
    const result = governanceService.detectGovernanceViolations({ dataQualitySnapshot: critical, hasAuditTrail: false, now: NOW });
    expect(result.some((violation) => violation.severity === 'critical')).toBe(true);
  });

  it('item publico com midia invalida', () => {
    const result = governanceService.evaluateExposurePolicy({ publicItem: publicItem({ media: { id: 'm1', status: 'invalid', variants: [] } }), now: NOW });
    expect(result.violations.some((violation) => violation.code === 'INVALID_MEDIA_EXPOSED')).toBe(true);
  });

  it('item publico sem coordenada', () => {
    const result = governanceService.evaluateExposurePolicy({ publicItem: publicItem({ location: undefined }), now: NOW });
    expect(result.violations.some((violation) => violation.code === 'INVALID_COORDINATE_IN_CATALOG')).toBe(true);
  });

  it('snapshot sem origem', () => {
    const result = governanceService.detectGovernanceViolations({ projectionSnapshot: projection({ metadata: { ...projection().metadata, source: '' } }), now: NOW });
    expect(result.some((violation) => violation.code === 'SNAPSHOT_WITHOUT_SOURCE')).toBe(true);
  });

  it('uso de Public API sem partner', () => {
    const usage: PublicApiUsageLog = { scopes: ['inventory:read'], endpoint: '/public', method: 'GET', status: 200, timestamp: NOW.toISOString(), requestId: 'req-1' };
    const result = governanceService.detectGovernanceViolations({ usageLog: usage, now: NOW });
    expect(result.some((violation) => violation.code === 'USAGE_LOG_WITHOUT_PARTNER')).toBe(true);
  });

  it('compatibilidade com Data Quality', () => {
    const snapshot = governanceService.buildGovernanceSnapshot({ dataQualitySnapshot: quality(), now: NOW });
    expect(snapshot.ok).toBe(true);
  });

  it('compatibilidade com Public API', () => {
    const result = governanceService.evaluateGovernance({ publicItem: publicItem(), now: NOW });
    expect(result.ok).toBe(true);
  });

  it('compatibilidade com Projection Layer', () => {
    const snapshot = governanceService.buildGovernanceSnapshot({ projectionSnapshot: projection(), dataQualitySnapshot: quality(), now: NOW });
    expect(snapshot.snapshot?.sourceProjectionId).toBe('projection-1');
  });
});
