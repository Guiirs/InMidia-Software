import { randomUUID } from 'crypto';
import type {
  ExportRequest,
  ExportResult,
  ExportLogEntry,
  ExportValidationResult,
  ExportDataset,
  ExportFormat,
  ExportProfile,
} from '../contracts/export.contracts';
import { EXPORT_BLOCKED_FIELDS } from '../contracts/export.contracts';
import { buildExportDataset, EXPORT_MAX_ROWS } from '../builders/export-dataset.builder';
import { buildJson, buildCsv } from '../builders/export-format.builder';
import { buildExportMetadata } from '../builders/export-metadata.builder';
import type { InMemoryEnterpriseBISnapshotStore } from '@modules/enterprise-bi/stores/enterprise-bi.snapshot-store';
import logger from '@shared/container/logger';

/** In-memory export log (last 200 entries). */
const exportLog: ExportLogEntry[] = [];
const EXPORT_LOG_MAX = 200;

/** Planned formats return a placeholder response without file generation. */
const PLANNED_FORMATS: ExportFormat[] = ['pdf', 'xlsx'];
const IMPLEMENTED_FORMATS: ExportFormat[] = ['json', 'csv'];

const VALID_PROFILES: ExportProfile[] = [
  'executive-summary',
  'regional-performance',
  'inventory-health',
  'quality-report',
  'governance-report',
];

const CONTENT_TYPES: Record<ExportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export class ExportService {
  constructor(
    private readonly biStore: InMemoryEnterpriseBISnapshotStore,
  ) {}

  // ── Validation ────────────────────────────────────────────

  validateExportRequest(req: Partial<ExportRequest>): ExportValidationResult {
    const errors: Array<{ field: string; message: string }> = [];

    if (!req.profile) {
      errors.push({ field: 'profile', message: 'Campo "profile" é obrigatório.' });
    } else if (!VALID_PROFILES.includes(req.profile as ExportProfile)) {
      errors.push({
        field: 'profile',
        message: `Perfil "${req.profile}" inválido. Opções: ${VALID_PROFILES.join(', ')}.`,
      });
    }

    if (!req.format) {
      errors.push({ field: 'format', message: 'Campo "format" é obrigatório.' });
    } else if (![...IMPLEMENTED_FORMATS, ...PLANNED_FORMATS].includes(req.format as ExportFormat)) {
      errors.push({
        field: 'format',
        message: `Formato "${req.format}" inválido. Opções: json, csv, pdf, xlsx.`,
      });
    }

    if (req.maxRows !== undefined) {
      if (typeof req.maxRows !== 'number' || req.maxRows < 1 || req.maxRows > EXPORT_MAX_ROWS) {
        errors.push({
          field: 'maxRows',
          message: `maxRows deve ser entre 1 e ${EXPORT_MAX_ROWS}.`,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ── Dataset builder ───────────────────────────────────────

  buildExportDataset(
    profile: ExportProfile,
    empresaId?: string,
    maxRows?: number,
  ): ExportDataset | null {
    const snapshot = this.biStore.getLatest({ tenantId: empresaId });
    if (!snapshot) return null;

    const biDataset = snapshot.datasets.find((d) => d.profile === profile);
    if (!biDataset) return null;

    return buildExportDataset(biDataset, profile, snapshot.id, maxRows);
  }

  // ── Formatters ────────────────────────────────────────────

  formatAsJson(dataset: ExportDataset): string {
    return buildJson(dataset.rows);
  }

  formatAsCsv(dataset: ExportDataset): string {
    return buildCsv(dataset.rows);
  }

  // ── Metadata ─────────────────────────────────────────────

  buildExportMetadata = buildExportMetadata;

  // ── Log ──────────────────────────────────────────────────

  registerExportLog(entry: ExportLogEntry): void {
    exportLog.push(entry);
    if (exportLog.length > EXPORT_LOG_MAX) {
      exportLog.splice(0, exportLog.length - EXPORT_LOG_MAX);
    }
    logger.info(`[ExportService] Export logged: ${entry.exportId} | ${entry.profile} | ${entry.format} | status=${entry.status}`);
  }

  getExportLog(): ExportLogEntry[] {
    return [...exportLog];
  }

  // ── Main orchestrator ─────────────────────────────────────

  buildExport(params: {
    request: ExportRequest;
    empresaId?: string;
    tenantId?: string;
  }): ExportResult {
    const { request, empresaId, tenantId } = params;
    const exportId = randomUUID();
    const requestedAt = new Date().toISOString();

    // Validation
    const validation = this.validateExportRequest(request);
    if (!validation.valid) {
      const meta = buildExportMetadata({
        exportId,
        requestedAt,
        generatedAt: requestedAt,
        profile: (request.profile ?? 'executive-summary') as ExportProfile,
        format: (request.format ?? 'json') as ExportFormat,
        status: 'failed',
        dataset: null,
        empresaId,
        tenantId,
        error: validation.errors.map((e) => e.message).join('; '),
      });
      return {
        exportId,
        status: 'failed',
        format: (request.format ?? 'json') as ExportFormat,
        profile: (request.profile ?? 'executive-summary') as ExportProfile,
        content: null,
        contentType: 'application/json',
        filename: 'export-error.json',
        metadata: meta,
        error: validation.errors.map((e) => e.message).join('; '),
      };
    }

    const profile = request.profile as ExportProfile;
    const format = request.format as ExportFormat;

    // Planned format path
    if (PLANNED_FORMATS.includes(format)) {
      const meta = buildExportMetadata({
        exportId,
        requestedAt,
        generatedAt: requestedAt,
        profile,
        format,
        status: 'planned',
        dataset: null,
        label: request.label,
        empresaId,
        tenantId,
      });
      this.registerExportLog({
        exportId,
        empresaId,
        tenantId,
        profile,
        format,
        status: 'planned',
        rowCount: 0,
        requestedAt,
        generatedAt: requestedAt,
        durationMs: 0,
      });
      return {
        exportId,
        status: 'planned',
        format,
        profile,
        content: null,
        contentType: CONTENT_TYPES[format],
        filename: `export-${profile}-planned.${format}`,
        metadata: meta,
      };
    }

    // Build dataset from BI store
    const t0 = Date.now();
    const dataset = this.buildExportDataset(profile, empresaId, request.maxRows);

    if (!dataset) {
      const generatedAt = new Date().toISOString();
      const meta = buildExportMetadata({
        exportId,
        requestedAt,
        generatedAt,
        profile,
        format,
        status: 'failed',
        dataset: null,
        label: request.label,
        empresaId,
        tenantId,
        error: 'Nenhum snapshot BI disponível para o perfil solicitado.',
      });
      this.registerExportLog({
        exportId,
        empresaId,
        tenantId,
        profile,
        format,
        status: 'failed',
        rowCount: 0,
        requestedAt,
        generatedAt,
        durationMs: Date.now() - t0,
        error: 'no snapshot',
      });
      return {
        exportId,
        status: 'failed',
        format,
        profile,
        content: null,
        contentType: CONTENT_TYPES[format],
        filename: `export-${profile}-failed.${format}`,
        metadata: meta,
        error: 'Nenhum snapshot BI disponível para o perfil solicitado.',
      };
    }

    // Format content
    let content: string;
    if (format === 'csv') {
      content = this.formatAsCsv(dataset);
    } else {
      content = this.formatAsJson(dataset);
    }

    const generatedAt = new Date().toISOString();
    const durationMs = Date.now() - t0;

    const meta = buildExportMetadata({
      exportId,
      requestedAt,
      generatedAt,
      profile,
      format,
      status: 'ready',
      dataset,
      label: request.label,
      empresaId,
      tenantId,
    });

    this.registerExportLog({
      exportId,
      empresaId,
      tenantId,
      profile,
      format,
      status: 'ready',
      rowCount: dataset.rowCount,
      requestedAt,
      generatedAt,
      durationMs,
    });

    const ext = format === 'csv' ? 'csv' : 'json';
    return {
      exportId,
      status: 'ready',
      format,
      profile,
      content,
      contentType: CONTENT_TYPES[format],
      filename: `export-${profile}-${exportId.slice(0, 8)}.${ext}`,
      metadata: meta,
    };
  }

  /** Return list of blocked field names (used in metadata/docs). */
  getBlockedFields(): string[] {
    return Array.from(EXPORT_BLOCKED_FIELDS);
  }
}
