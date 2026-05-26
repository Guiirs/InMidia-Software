// ============================================================
// Export Layer — Contracts
// ============================================================

import type { EnterpriseBIExportProfile } from '@modules/enterprise-bi/contracts/enterprise-bi.contracts';

// ── Formats ──────────────────────────────────────────────────

/** Currently implemented formats. */
export type ExportFormatImplemented = 'json' | 'csv';

/** Planned but not yet implemented. */
export type ExportFormatPlanned = 'pdf' | 'xlsx';

/** All accepted format values in an export request. */
export type ExportFormat = ExportFormatImplemented | ExportFormatPlanned;

// ── Profiles ─────────────────────────────────────────────────

/** Re-export BI profile names as export profile type. */
export type ExportProfile = EnterpriseBIExportProfile;

// ── Status ───────────────────────────────────────────────────

export type ExportStatus =
  | 'pending'
  | 'building'
  | 'ready'
  | 'failed'
  | 'planned';

// ── Visibility ───────────────────────────────────────────────

export type ExportVisibility = 'internal' | 'executive' | 'restricted';

// ── Sensitive fields — always stripped from exported output ──

export const EXPORT_BLOCKED_FIELDS: ReadonlyArray<string> = [
  'password',
  'token',
  'apiKey',
  'secret',
  'tenantId',
  'cpf',
  'cnpj',
  'email',
  'phone',
  'telefone',
];

// ── Request ──────────────────────────────────────────────────

export interface ExportRequest {
  /** Profile determines which BI dataset is exported. */
  profile: ExportProfile;

  /** Desired output format. */
  format: ExportFormat;

  /** Optional label for this export (displayed in metadata). */
  label?: string;

  /** Limit rows in export output (safety cap). */
  maxRows?: number;

  /** Additional free-form options (reserved for future use). */
  options?: Record<string, unknown>;
}

// ── Dataset row ───────────────────────────────────────────────

export interface ExportDatasetRow {
  [key: string]: string | number | boolean | null | undefined;
}

// ── Dataset ───────────────────────────────────────────────────

export interface ExportDataset {
  profile: ExportProfile;
  rowCount: number;
  rows: ExportDatasetRow[];
  metrics: Array<{ key: string; label: string; value: number; unit: string }>;
  completeness: 'complete' | 'partial';
  snapshotId: string;
  generatedAt: string;
}

// ── Metadata ─────────────────────────────────────────────────

export interface ExportMetadata {
  exportId: string;
  requestedAt: string;
  generatedAt: string;
  profile: ExportProfile;
  format: ExportFormat;
  rowCount: number;
  blocked: boolean;
  blockedFields: string[];
  label?: string;
  empresaId?: string;
  tenantId?: string;
  grain: string;
  visibility: ExportVisibility;
  status: ExportStatus;
}

// ── Result ───────────────────────────────────────────────────

export interface ExportResult {
  exportId: string;
  status: ExportStatus;
  format: ExportFormat;
  profile: ExportProfile;
  content: string | null;
  contentType: string;
  filename: string;
  metadata: ExportMetadata;
  error?: string;
}

// ── Profile spec ─────────────────────────────────────────────

export interface ExportProfileSpec {
  profile: ExportProfile;
  label: string;
  description: string;
  availableFormats: ExportFormat[];
  plannedFormats: ExportFormatPlanned[];
  visibility: ExportVisibility;
}

// ── Validation error ─────────────────────────────────────────

export interface ExportValidationError {
  field: string;
  message: string;
}

export interface ExportValidationResult {
  valid: boolean;
  errors: ExportValidationError[];
}

// ── Log entry ────────────────────────────────────────────────

export interface ExportLogEntry {
  exportId: string;
  empresaId?: string;
  tenantId?: string;
  profile: ExportProfile;
  format: ExportFormat;
  status: ExportStatus;
  rowCount: number;
  requestedAt: string;
  generatedAt: string;
  durationMs: number;
  error?: string;
}
