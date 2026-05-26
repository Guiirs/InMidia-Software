import type {
  ExportDataset,
  ExportDatasetRow,
  ExportProfile,
} from '../contracts/export.contracts';
import type { EnterpriseBIDataset } from '@modules/enterprise-bi/contracts/enterprise-bi.contracts';
import { sanitizeRow } from './export-format.builder';

/**
 * Maximum rows allowed in a single export (safety cap).
 */
export const EXPORT_MAX_ROWS = 5000;

/**
 * Converts an EnterpriseBIDataset row to a flat ExportDatasetRow,
 * projecting only fields safe for export.
 */
function flattenBIRow(
  row: EnterpriseBIDataset['rows'][number],
): Record<string, unknown> {
  return {
    id: row.id,
    label: row.label,
    grain: row.grain,
    availability: row.availability ?? null,
    occupancyRate: row.occupancyRate ?? null,
    qualityScore: row.qualityScore ?? null,
    governanceScore: row.governanceScore ?? null,
    severity: row.severity ?? null,
    mediaValid: row.mediaValid ?? null,
    regiaoId: row.regiaoId ?? null,
    // NOTE: empresaId included at summary level, NOT per-row (privacy)
    metricsCount: row.metrics?.length ?? 0,
  };
}

/**
 * Build an ExportDataset from an EnterpriseBIDataset, applying sanitation.
 */
export function buildExportDataset(
  biDataset: EnterpriseBIDataset,
  profile: ExportProfile,
  snapshotId: string,
  maxRows: number = EXPORT_MAX_ROWS,
): ExportDataset {
  const rawRows = biDataset.rows.slice(0, maxRows);
  const sanitized: ExportDatasetRow[] = rawRows.map((r) => sanitizeRow(flattenBIRow(r)));

  return {
    profile,
    rowCount: sanitized.length,
    rows: sanitized,
    metrics: (biDataset.metrics ?? []).map((m) => ({
      key: m.key,
      label: m.label,
      value: m.value,
      unit: m.unit,
    })),
    completeness: biDataset.completeness,
    snapshotId,
    generatedAt: biDataset.generatedAt,
  };
}
