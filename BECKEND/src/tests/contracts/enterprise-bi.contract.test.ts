import type { EnterpriseBISnapshot } from '@modules/enterprise-bi';

describe('EnterpriseBIContract', () => {
  it('exposes canonical BI snapshot fields', () => {
    const snapshot: EnterpriseBISnapshot = {
      id: 'bi-1',
      tenantId: 'empresa-1',
      generatedAt: '2026-05-18T12:00:00.000Z',
      sourceOperationalAnalyticsSnapshotId: 'op-1',
      sourceProjectionId: 'projection-1',
      sourceProjectionVersion: 1,
      grain: 'global',
      exportProfile: 'executive-summary',
      visibility: 'executive',
      datasets: [],
      metrics: [],
      summary: {
        datasetCount: 0,
        rowCount: 0,
        incompleteDatasets: 0,
        blockedSensitiveFields: 0,
        hasSensitiveData: false,
        exportedProfile: 'executive-summary',
        grain: 'global',
        visibility: 'executive',
      },
    };

    expect(snapshot.exportProfile).toBe('executive-summary');
    expect(snapshot.summary.datasetCount).toBe(0);
  });
});
