import type {
  EnterpriseBIContext,
  EnterpriseBIDataset,
  EnterpriseBIFilter,
  EnterpriseBIExportProfileSpec,
  EnterpriseBIQuery,
  EnterpriseBISnapshot,
} from '../contracts/enterprise-bi.contracts';

describe('Enterprise BI contracts', () => {
  it('represents enterprise bi contracts', () => {
    const filter: EnterpriseBIFilter = { field: 'qualityScore', operator: 'gte', value: 80 };
    const query: EnterpriseBIQuery = { datasetId: 'executive', filters: [filter], limit: 10, offset: 0 };
    const context: EnterpriseBIContext = {
      operationalAnalyticsSnapshot: {} as EnterpriseBIContext['operationalAnalyticsSnapshot'],
      projectionSnapshot: {} as EnterpriseBIContext['projectionSnapshot'],
    };
    const profile: EnterpriseBIExportProfileSpec = {
      profile: 'executive-summary',
      grain: 'global',
      visibility: 'executive',
      datasets: ['executive'],
      description: 'Resumo executivo',
    };
    const dataset: EnterpriseBIDataset = {
      id: 'executive',
      name: 'Executivo',
      description: 'Resumo',
      grain: 'global',
      profile: 'executive-summary',
      visibility: 'executive',
      generatedAt: '2026-05-18T12:00:00.000Z',
      rowCount: 0,
      metrics: [],
      rows: [],
      filtersApplied: [],
      completeness: 'partial',
      source: { operationalAnalyticsSnapshotId: 'op-1', projectionSnapshotId: 'proj-1' },
    };
    const snapshot: EnterpriseBISnapshot = {
      id: 'bi-1',
      tenantId: 'empresa-1',
      generatedAt: '2026-05-18T12:00:00.000Z',
      sourceOperationalAnalyticsSnapshotId: 'op-1',
      sourceProjectionId: 'proj-1',
      sourceProjectionVersion: 1,
      grain: 'global',
      exportProfile: 'executive-summary',
      visibility: 'executive',
      datasets: [dataset],
      metrics: [],
      summary: {
        datasetCount: 1,
        rowCount: 0,
        incompleteDatasets: 1,
        blockedSensitiveFields: 0,
        hasSensitiveData: false,
        exportedProfile: 'executive-summary',
        grain: 'global',
        visibility: 'executive',
      },
    };

    expect(filter.field).toBe('qualityScore');
    expect(query.limit).toBe(10);
    expect(context.projectionSnapshot).toBeDefined();
    expect(profile.datasets).toContain('executive');
    expect(dataset.grain).toBe('global');
    expect(snapshot.summary.datasetCount).toBe(1);
  });
});
