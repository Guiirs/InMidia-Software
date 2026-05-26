import { dataQualityService } from '@modules/data-quality';
import { geoIntelligenceService } from '@modules/geo-intelligence';
import { governanceService } from '@modules/governance';
import { OperationalAnalyticsService } from '@modules/operational-analytics';
import { OperationalAnalyticsSnapshotStore } from '@modules/operational-analytics';
import type { ProjectionSnapshot } from '@modules/projections';
import { ProjectionService } from '@modules/projections';
import { InMemoryEnterpriseBISnapshotStore } from '../stores/enterprise-bi.snapshot-store';
import { EnterpriseBIService } from '../services/enterprise-bi.service';
import { RegionalBIPresenter } from '../presenters/enterprise-bi.presenters';

const NOW = new Date('2026-05-18T12:00:00.000Z');

function buildProjectionSnapshot(): ProjectionSnapshot {
  const projectionService = new ProjectionService();
  const result = projectionService.buildProjectionSnapshot({
    inventorySources: [
      { placa: { _id: 'p-1', empresaId: 'empresa-1', regiaoId: 'regiao-1', numero_placa: 'OOH-1', numeroOperacional: 1, coordenadas: '-23.55,-46.63', disponivel: true } },
      { placa: { _id: 'p-2', empresaId: 'empresa-1', regiaoId: 'regiao-1', numero_placa: 'OOH-2', numeroOperacional: 2, coordenadas: '-23.56,-46.64', disponivel: true }, alugueis: [{ id: 'a-1', status: 'ativo', startDate: NOW.toISOString(), endDate: '2026-06-30T00:00:00.000Z' }] },
      { placa: { _id: 'p-3', empresaId: 'empresa-1', regiaoId: 'regiao-2', numero_placa: 'OOH-3', numeroOperacional: 3, coordenadas: null, disponivel: true }, contratos: [{ id: 'c-1', status: 'ativo' }] },
    ],
  }, { tenantId: 'empresa-1', source: 'test', now: NOW });

  if (!result.projection) throw new Error('Projection snapshot was not built');
  return result.projection;
}

function buildContext() {
  const projectionSnapshot = buildProjectionSnapshot();
  const geoResult = geoIntelligenceService.buildGeoIntelligenceSnapshot({ snapshot: projectionSnapshot, knownRegionIds: ['regiao-1', 'regiao-2'], now: NOW });
  const qualitySnapshot = dataQualityService.buildQualitySnapshot({ snapshot: projectionSnapshot, geoSnapshot: geoResult.snapshot, now: NOW });
  const governanceSnapshot = governanceService.buildGovernanceSnapshot({ projectionSnapshot, dataQualitySnapshot: qualitySnapshot, now: NOW });
  const operationalAnalyticsSnapshot = new OperationalAnalyticsService(new OperationalAnalyticsSnapshotStore()).buildOperationalAnalytics({ projectionSnapshot, geoSnapshot: geoResult.snapshot, qualitySnapshot, governanceSnapshot: governanceSnapshot.snapshot, knownRegionIds: ['regiao-1', 'regiao-2'], generatedBy: 'test', now: NOW });

  if (!geoResult.snapshot || !governanceSnapshot.snapshot) throw new Error('Dependent snapshots were not built');

  return { projectionSnapshot, geoSnapshot: geoResult.snapshot, qualitySnapshot, governanceSnapshot: governanceSnapshot.snapshot, operationalAnalyticsSnapshot };
}

describe('EnterpriseBIService', () => {
  it('builds executive dataset', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const dataset = service.buildExecutiveDataset(buildContext());

    expect(dataset.id).toBe('executive');
    expect(dataset.rows[0]?.metrics.some((metric) => metric.key === 'executive.total-placas')).toBe(true);
  });

  it('builds regional dataset', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const dataset = service.buildRegionalDataset(buildContext());

    expect(dataset.rows.length).toBeGreaterThan(0);
    expect(dataset.rows.some((row) => row.regiaoId === 'regiao-1')).toBe(true);
  });

  it('builds inventory dataset', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const dataset = service.buildInventoryDataset(buildContext());

    expect(dataset.rows.some((row) => row.placaId === 'p-1')).toBe(true);
  });

  it('builds quality dataset', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const dataset = service.buildQualityDataset(buildContext());

    expect(dataset.rows[0]?.qualityScore).toBeDefined();
  });

  it('builds governance dataset', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const dataset = service.buildGovernanceDataset(buildContext());

    expect(dataset.rows[0]?.metrics.some((metric) => metric.key === 'governance.score')).toBe(true);
  });

  it('filters by tenant empresa and region', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const snapshot = service.buildBISnapshot(buildContext());
    const result = service.queryDataset({ datasetId: 'inventory', filters: [{ field: 'tenantId', operator: 'eq', value: snapshot.tenantId ?? 'empresa-1' }, { field: 'regiaoId', operator: 'eq', value: 'regiao-1' }] });

    expect(result.ok).toBe(true);
    expect(result.rows.every((row) => row.regiaoId === 'regiao-1')).toBe(true);
  });

  it('filters by quality and availability', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    service.buildBISnapshot(buildContext());
    const result = service.queryDataset({ datasetId: 'inventory', filters: [{ field: 'qualityScore', operator: 'gte', value: 80 }, { field: 'availability', operator: 'eq', value: 'available' }] });

    expect(result.ok).toBe(true);
    expect(result.rows.every((row) => (row.qualityScore ?? 0) >= 80)).toBe(true);
  });

  it('builds BI snapshot', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const snapshot = service.buildBISnapshot(buildContext());

    expect(snapshot.summary.datasetCount).toBeGreaterThanOrEqual(9);
    expect(snapshot.sourceOperationalAnalyticsSnapshotId).toBeDefined();
  });

  it('queries dataset', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    service.buildBISnapshot(buildContext());
    const result = service.queryDataset({ datasetId: 'regional', limit: 2 });

    expect(result.ok).toBe(true);
    expect(result.dataset?.id).toBe('regional');
  });

  it('presenter is safe', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const dataset = service.buildRegionalDataset(buildContext());
    const presentation = new RegionalBIPresenter().present(dataset);

    expect((presentation.rows[0] as unknown as { id?: unknown }).id).toBeUndefined();
    expect(presentation.rows[0]?.regiaoId).toBeDefined();
  });

  it('supports export profiles', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const snapshot = service.buildBISnapshot({ ...buildContext(), profile: 'quality-report' });

    expect(snapshot.exportProfile).toBe('quality-report');
  });

  it('is compatible with Operational Analytics', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const snapshot = service.buildBISnapshot(buildContext());

    expect(snapshot.sourceOperationalAnalyticsSnapshotId).toBeDefined();
  });

  it('is compatible with Data Quality', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const snapshot = service.buildBISnapshot(buildContext());

    expect(snapshot.summary.incompleteDatasets).toBeGreaterThanOrEqual(0);
  });

  it('is compatible with Governance', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const snapshot = service.buildBISnapshot(buildContext());

    expect(snapshot.datasets.some((dataset) => dataset.id === 'governance')).toBe(true);
  });

  it('is compatible with Geo Intelligence', () => {
    const service = new EnterpriseBIService(new InMemoryEnterpriseBISnapshotStore());
    const snapshot = service.buildBISnapshot(buildContext());

    expect(snapshot.datasets.some((dataset) => dataset.id === 'geo')).toBe(true);
  });
});
