import { ExportService } from '@modules/export/services/export.service';
import {
  buildCsv,
  buildJson,
  sanitizeRow,
} from '@modules/export/builders/export-format.builder';
import { buildExportDataset } from '@modules/export/builders/export-dataset.builder';
import { getAllExportProfileSpecs, getExportProfileSpec } from '@modules/export/presenters/export-profiles.presenter';
import { EXPORT_BLOCKED_FIELDS } from '@modules/export/contracts/export.contracts';
import type { EnterpriseBIDataset } from '@modules/enterprise-bi/contracts/enterprise-bi.contracts';
import { InMemoryEnterpriseBISnapshotStore } from '@modules/enterprise-bi/stores/enterprise-bi.snapshot-store';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockBIDataset(profile: string): EnterpriseBIDataset {
  return {
    id: `ds-${profile}`,
    name: profile,
    description: `Mock ${profile}`,
    grain: 'empresa',
    profile: profile as EnterpriseBIDataset['profile'],
    visibility: 'executive',
    generatedAt: '2026-05-18T12:00:00.000Z',
    rowCount: 2,
    metrics: [{ key: 'total_placas', label: 'Total', value: 10, unit: 'count', category: 'inventory', grain: 'empresa' }],
    rows: [
      {
        id: 'r-1', grain: 'empresa', profile: profile as EnterpriseBIDataset['profile'],
        visibility: 'executive', label: 'Região A', regiaoId: 'reg-1',
        occupancyRate: 75, qualityScore: 88, governanceScore: 91, severity: 'low',
        availability: 'available', mediaValid: true, metrics: [],
        // These should be stripped by sanitizer:
        tenantId: 'tenant-001',
      } as unknown,
      {
        id: 'r-2', grain: 'empresa', profile: profile as EnterpriseBIDataset['profile'],
        visibility: 'executive', label: 'Região B', regiaoId: 'reg-2',
        occupancyRate: 30, qualityScore: 45, governanceScore: 60, severity: 'high',
        availability: 'occupied', mediaValid: false, metrics: [],
      },
    ] as EnterpriseBIDataset['rows'],
    filtersApplied: [],
    completeness: 'complete',
    source: {
      operationalAnalyticsSnapshotId: 'op-1',
      projectionSnapshotId: 'proj-1',
    },
  };
}

function makeMockSnapshot(profile: string = 'executive-summary') {
  const biDataset = makeMockBIDataset(profile);
  return {
    id: 'snap-1',
    tenantId: 'tenant-001',
    empresaId: 'empresa-001',
    generatedAt: '2026-05-18T12:00:00.000Z',
    sourceOperationalAnalyticsSnapshotId: 'op-1',
    sourceProjectionId: 'proj-1',
    sourceProjectionVersion: 1,
    grain: 'empresa' as const,
    exportProfile: profile as EnterpriseBIDataset['profile'],
    visibility: 'executive' as const,
    datasets: [biDataset],
    metrics: [],
    summary: {
      datasetCount: 1,
      rowCount: 2,
      incompleteDatasets: 0,
      blockedSensitiveFields: 0,
      hasSensitiveData: false,
      exportedProfile: profile as EnterpriseBIDataset['profile'],
      grain: 'empresa' as const,
      visibility: 'executive' as const,
    },
  };
}

// ── sanitizeRow ───────────────────────────────────────────────────────────────

describe('sanitizeRow', () => {
  it('removes blocked fields', () => {
    const row = { label: 'A', tenantId: 'secret', password: 'pw123', occupancyRate: 75 };
    const result = sanitizeRow(row);
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('password');
    expect(result.label).toBe('A');
    expect(result.occupancyRate).toBe(75);
  });

  it('keeps null values as null', () => {
    const row = { label: 'A', qualityScore: null };
    const result = sanitizeRow(row as never);
    expect(result.qualityScore).toBeNull();
  });

  it('serializes nested objects as strings', () => {
    const row = { label: 'A', meta: { x: 1 } };
    const result = sanitizeRow(row as never);
    expect(typeof result.meta).toBe('string');
  });

  it('never exposes any EXPORT_BLOCKED_FIELDS', () => {
    const dirty: Record<string, unknown> = {};
    for (const f of EXPORT_BLOCKED_FIELDS) dirty[f] = 'sensitive';
    dirty.label = 'safe';
    const result = sanitizeRow(dirty);
    for (const f of EXPORT_BLOCKED_FIELDS) {
      expect(result).not.toHaveProperty(f);
    }
    expect(result.label).toBe('safe');
  });
});

// ── buildCsv ──────────────────────────────────────────────────────────────────

describe('buildCsv', () => {
  it('returns empty string for empty rows', () => {
    expect(buildCsv([])).toBe('');
  });

  it('builds header + data rows', () => {
    const rows = [{ label: 'A', score: 90 }, { label: 'B', score: 70 }];
    const csv = buildCsv(rows);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('label');
    expect(lines[0]).toContain('score');
    expect(lines[1]).toContain('A');
    expect(lines[2]).toContain('B');
  });

  it('escapes commas in values', () => {
    const rows = [{ label: 'A, Inc', score: 90 }];
    const csv = buildCsv(rows);
    expect(csv).toContain('"A, Inc"');
  });

  it('escapes double-quotes in values', () => {
    const rows = [{ label: 'Say "hello"', score: 5 }];
    const csv = buildCsv(rows);
    expect(csv).toContain('""hello""');
  });
});

// ── buildJson ─────────────────────────────────────────────────────────────────

describe('buildJson', () => {
  it('produces valid JSON array', () => {
    const rows = [{ label: 'A', score: 90 }];
    const json = buildJson(rows);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].label).toBe('A');
  });

  it('does not include blocked fields in json output (via sanitizeRow)', () => {
    // sanitizeRow is applied before buildJson in the pipeline
    const row = { label: 'A', tenantId: 'secret' };
    const sanitized = sanitizeRow(row as never);
    const json = buildJson([sanitized]);
    const parsed = JSON.parse(json);
    expect(parsed[0]).not.toHaveProperty('tenantId');
  });
});

// ── buildExportDataset ────────────────────────────────────────────────────────

describe('buildExportDataset', () => {
  it('returns sanitized rows from a BI dataset', () => {
    const biDataset = makeMockBIDataset('executive-summary');
    const result = buildExportDataset(biDataset, 'executive-summary', 'snap-1');
    expect(result.rowCount).toBe(2);
    expect(result.rows[0]).not.toHaveProperty('tenantId');
    expect(result.rows[0]).toHaveProperty('label');
  });

  it('respects maxRows limit', () => {
    const biDataset = makeMockBIDataset('executive-summary');
    const result = buildExportDataset(biDataset, 'executive-summary', 'snap-1', 1);
    expect(result.rowCount).toBe(1);
  });

  it('includes metrics from BI dataset', () => {
    const biDataset = makeMockBIDataset('regional-performance');
    const result = buildExportDataset(biDataset, 'regional-performance', 'snap-1');
    expect(result.metrics.length).toBeGreaterThan(0);
    expect(result.metrics[0]?.key).toBe('total_placas');
  });
});

// ── ExportProfileSpecs ────────────────────────────────────────────────────────

describe('getAllExportProfileSpecs', () => {
  it('returns 5 profiles', () => {
    const specs = getAllExportProfileSpecs();
    expect(specs).toHaveLength(5);
  });

  it('each profile has json and csv in availableFormats', () => {
    const specs = getAllExportProfileSpecs();
    for (const s of specs) {
      expect(s.availableFormats).toContain('json');
      expect(s.availableFormats).toContain('csv');
    }
  });

  it('each profile has pdf and xlsx in plannedFormats', () => {
    const specs = getAllExportProfileSpecs();
    for (const s of specs) {
      expect(s.plannedFormats).toContain('pdf');
      expect(s.plannedFormats).toContain('xlsx');
    }
  });
});

describe('getExportProfileSpec', () => {
  it('returns spec for known profile', () => {
    const spec = getExportProfileSpec('executive-summary');
    expect(spec).toBeDefined();
    expect(spec!.label).toBeTruthy();
  });

  it('returns undefined for unknown profile', () => {
    const spec = getExportProfileSpec('unknown-profile');
    expect(spec).toBeUndefined();
  });
});

// ── ExportService ─────────────────────────────────────────────────────────────

describe('ExportService', () => {
  let store: InMemoryEnterpriseBISnapshotStore;
  let service: ExportService;

  beforeEach(() => {
    store = new InMemoryEnterpriseBISnapshotStore();
    service = new ExportService(store);
  });

  describe('validateExportRequest', () => {
    it('returns valid for a correct request', () => {
      const result = service.validateExportRequest({ profile: 'executive-summary', format: 'json' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for missing profile', () => {
      const result = service.validateExportRequest({ format: 'csv' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'profile')).toBe(true);
    });

    it('returns error for missing format', () => {
      const result = service.validateExportRequest({ profile: 'executive-summary' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'format')).toBe(true);
    });

    it('accepts pdf and xlsx as valid (planned) formats', () => {
      expect(service.validateExportRequest({ profile: 'executive-summary', format: 'pdf' }).valid).toBe(true);
      expect(service.validateExportRequest({ profile: 'executive-summary', format: 'xlsx' }).valid).toBe(true);
    });

    it('rejects unknown format', () => {
      const result = service.validateExportRequest({ profile: 'executive-summary', format: 'docx' as never });
      expect(result.valid).toBe(false);
    });
  });

  describe('buildExport — empty store', () => {
    it('returns failed status when no snapshot', () => {
      const result = service.buildExport({ request: { profile: 'executive-summary', format: 'json' } });
      expect(result.status).toBe('failed');
      expect(result.content).toBeNull();
    });
  });

  describe('buildExport — planned formats', () => {
    it('returns planned for pdf', () => {
      const result = service.buildExport({ request: { profile: 'executive-summary', format: 'pdf' } });
      expect(result.status).toBe('planned');
      expect(result.content).toBeNull();
    });

    it('returns planned for xlsx', () => {
      const result = service.buildExport({ request: { profile: 'regional-performance', format: 'xlsx' } });
      expect(result.status).toBe('planned');
    });
  });

  describe('buildExport — with snapshot', () => {
    beforeEach(() => {
      store.save(makeMockSnapshot('executive-summary'), 'empresa-001');
    });

    it('returns ready status for json', () => {
      const result = service.buildExport({
        request: { profile: 'executive-summary', format: 'json' },
        empresaId: 'empresa-001',
      });
      expect(result.status).toBe('ready');
      expect(typeof result.content).toBe('string');
      expect(result.content!.length).toBeGreaterThan(0);
    });

    it('returns ready status for csv', () => {
      const result = service.buildExport({
        request: { profile: 'executive-summary', format: 'csv' },
        empresaId: 'empresa-001',
      });
      expect(result.status).toBe('ready');
      expect(result.content).toBeTruthy();
    });

    it('json content does not contain tenantId (sensitive field)', () => {
      const result = service.buildExport({
        request: { profile: 'executive-summary', format: 'json' },
        empresaId: 'empresa-001',
      });
      const parsed = JSON.parse(result.content!);
      for (const row of parsed) {
        expect(row).not.toHaveProperty('tenantId');
        expect(row).not.toHaveProperty('password');
        expect(row).not.toHaveProperty('email');
      }
    });

    it('csv content does not contain tenantId header', () => {
      const result = service.buildExport({
        request: { profile: 'executive-summary', format: 'csv' },
        empresaId: 'empresa-001',
      });
      const lines = result.content!.split('\r\n');
      const header = lines[0];
      expect(header).not.toContain('tenantId');
      expect(header).not.toContain('email');
    });

    it('metadata has correct profile and format', () => {
      const result = service.buildExport({
        request: { profile: 'executive-summary', format: 'json', label: 'Test Export' },
        empresaId: 'empresa-001',
      });
      expect(result.metadata.profile).toBe('executive-summary');
      expect(result.metadata.format).toBe('json');
      expect(result.metadata.label).toBe('Test Export');
      expect(result.metadata.status).toBe('ready');
    });

    it('registers entry in export log', () => {
      service.buildExport({
        request: { profile: 'executive-summary', format: 'json' },
        empresaId: 'empresa-001',
      });
      const log = service.getExportLog();
      expect(log.length).toBeGreaterThan(0);
      const last = log[log.length - 1];
      expect(last?.status).toBe('ready');
    });

    it('respects maxRows option', () => {
      const result = service.buildExport({
        request: { profile: 'executive-summary', format: 'json', maxRows: 1 },
        empresaId: 'empresa-001',
      });
      const parsed = JSON.parse(result.content!);
      expect(parsed).toHaveLength(1);
    });
  });

  describe('buildExport — all profiles', () => {
    const profiles = [
      'executive-summary',
      'regional-performance',
      'inventory-health',
      'quality-report',
      'governance-report',
    ] as const;

    for (const profile of profiles) {
      it(`builds ${profile} export without error`, () => {
        store.save(makeMockSnapshot(profile), 'empresa-001');
        const result = service.buildExport({
          request: { profile, format: 'json' },
          empresaId: 'empresa-001',
        });
        expect(result.status).toBe('ready');
        expect(result.profile).toBe(profile);
      });
    }
  });
});
