import type { Request, Response } from 'express';
import { ExportService } from '../services/export.service';
import { localEnterpriseBISnapshotStore } from '@modules/enterprise-bi/stores/enterprise-bi.snapshot-store';
import { getAllExportProfileSpecs } from '../presenters/export-profiles.presenter';
import type { ExportRequest } from '../contracts/export.contracts';

const exportService = new ExportService(localEnterpriseBISnapshotStore);

function resolveEmpresaId(req: Request): string | undefined {
  return (
    req.tenantContext?.empresaId ??
    (req.user as { empresaId?: string } | undefined)?.empresaId
  );
}

/**
 * POST /api/v1/exports
 * Body: { profile, format, label?, maxRows? }
 */
export function createExport(req: Request, res: Response): void {
  const empresaId = resolveEmpresaId(req);
  const tenantId = req.tenantContext?.empresaId;

  const request: Partial<ExportRequest> = {
    profile: req.body?.profile,
    format: req.body?.format,
    label: req.body?.label,
    maxRows: req.body?.maxRows,
    options: req.body?.options,
  };

  // Quick validation before delegating to service
  const validation = exportService.validateExportRequest(request);
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      errors: validation.errors,
    });
    return;
  }

  const result = exportService.buildExport({
    request: request as ExportRequest,
    empresaId,
    tenantId,
  });

  if (result.status === 'failed') {
    res.status(422).json({
      success: false,
      exportId: result.exportId,
      error: result.error,
      metadata: result.metadata,
    });
    return;
  }

  if (result.status === 'planned') {
    res.status(202).json({
      success: true,
      exportId: result.exportId,
      status: 'planned',
      message: `O formato "${result.format}" está planejado e ainda não disponível para download.`,
      metadata: result.metadata,
    });
    return;
  }

  // Ready — respond with content
  res.status(200).json({
    success: true,
    exportId: result.exportId,
    status: result.status,
    format: result.format,
    profile: result.profile,
    filename: result.filename,
    content: result.content,
    metadata: result.metadata,
  });
}

/**
 * GET /api/v1/exports/profiles
 * Returns available export profiles and their supported formats.
 */
export function getExportProfiles(_req: Request, res: Response): void {
  const specs = getAllExportProfileSpecs();
  res.json({
    success: true,
    profiles: specs,
    blockedFields: exportService.getBlockedFields(),
  });
}

/**
 * GET /api/v1/exports/:id/status
 * Returns status from the in-memory export log.
 */
export function getExportStatus(req: Request, res: Response): void {
  const { id } = req.params;

  if (!id || typeof id !== 'string' || id.length < 8) {
    res.status(400).json({ success: false, error: 'Export ID inválido.' });
    return;
  }

  const log = exportService.getExportLog();
  const entry = log.find((e) => e.exportId === id);

  if (!entry) {
    res.status(404).json({
      success: false,
      error: 'Export não encontrado. O histórico em memória é volátil — reinicializações apagam entradas antigas.',
    });
    return;
  }

  res.json({
    success: true,
    exportId: entry.exportId,
    status: entry.status,
    profile: entry.profile,
    format: entry.format,
    rowCount: entry.rowCount,
    requestedAt: entry.requestedAt,
    generatedAt: entry.generatedAt,
    durationMs: entry.durationMs,
    error: entry.error ?? null,
  });
}

export { exportService };
