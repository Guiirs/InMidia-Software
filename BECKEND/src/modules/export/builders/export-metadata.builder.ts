import type {
  ExportDataset,
  ExportMetadata,
  ExportProfile,
  ExportFormat,
  ExportStatus,
  ExportVisibility,
} from '../contracts/export.contracts';
import { EXPORT_BLOCKED_FIELDS } from '../contracts/export.contracts';

/**
 * Build export metadata for a completed (or failed) export.
 */
export function buildExportMetadata(params: {
  exportId: string;
  requestedAt: string;
  generatedAt: string;
  profile: ExportProfile;
  format: ExportFormat;
  status: ExportStatus;
  dataset: ExportDataset | null;
  label?: string;
  empresaId?: string;
  tenantId?: string;
  visibility?: ExportVisibility;
  error?: string;
}): ExportMetadata {
  const {
    exportId,
    requestedAt,
    generatedAt,
    profile,
    format,
    status,
    dataset,
    label,
    empresaId,
    tenantId,
    visibility = 'executive',
    error: _error,
  } = params;

  return {
    exportId,
    requestedAt,
    generatedAt,
    profile,
    format,
    rowCount: dataset?.rowCount ?? 0,
    blocked: false,
    blockedFields: Array.from(EXPORT_BLOCKED_FIELDS),
    label,
    empresaId: empresaId ?? undefined,
    tenantId: tenantId ?? undefined,
    grain: 'empresa',
    visibility,
    status,
  };
}
