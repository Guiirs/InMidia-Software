import type {
  DataIntegrityResult,
  DataQualityContext,
  DataQualityIssue,
} from '../contracts/data-quality.contracts';
import { createIssue } from '../diagnostics/data-quality.issue-factory';

function score(total: number, issues: number): number {
  if (total <= 0) return issues > 0 ? 50 : 100;
  return Math.max(0, Math.round(100 - (issues / total) * 100));
}

export class IntegrityAnalyzer {
  analyze(context: DataQualityContext): DataIntegrityResult {
    const snapshot = context.snapshot;
    const items = snapshot?.inventory.items ?? [];
    const issues: DataQualityIssue[] = [];
    const knownRegions = new Set(context.knownRegionIds ?? []);
    const itemIds = new Set(items.map((item) => item.placaId));

    if (snapshot && !snapshot.metadata.source) {
      issues.push(createIssue('PROJECTION_WITHOUT_SOURCE', 'structural', 'high', 'Projection snapshot sem origem de calculo.', snapshot.metadata.projectionId));
    }

    if (snapshot && snapshot.metadata.itemCount !== items.length) {
      issues.push(createIssue('SNAPSHOT_INCONSISTENT', 'structural', 'high', 'Metadata itemCount diverge da quantidade de itens.', snapshot.metadata.projectionId, {
        metadataItemCount: snapshot.metadata.itemCount,
        inventoryItems: items.length,
      }));
    }

    snapshot?.spatial.points.forEach((point) => {
      if (!itemIds.has(point.placaId)) {
        issues.push(createIssue('ORPHAN_DATA', 'geo', 'high', 'Ponto espacial sem item de inventario correspondente.', point.placaId));
      }
    });

    items.forEach((item) => {
      if (knownRegions.size > 0 && item.regiaoId && !knownRegions.has(item.regiaoId)) {
        issues.push(createIssue('REGION_NOT_FOUND', 'territorial', 'high', 'Regiao referenciada nao existe no contexto conhecido.', item.placaId, {
          regiaoId: item.regiaoId,
        }));
      }
      if (!item.empresaId) {
        issues.push(createIssue('BROKEN_REFERENCE', 'structural', 'critical', 'Item sem empresa/tenant associado.', item.placaId));
      }
    });

    (context.publicInventory ?? []).forEach((item) => {
      if (item.media && (item.media.status === 'invalid' || item.media.status === 'failed')) {
        issues.push(createIssue('MEDIA_NOT_FOUND', 'media', 'medium', 'Midia publica aponta para asset indisponivel.', item.id));
      }
    });

    (context.realtimeEvents ?? []).forEach((event) => {
      if (!event.id || !event.type || !event.occurredAt || !event.source) {
        issues.push(createIssue('REALTIME_EVENT_INVALID', 'structural', 'medium', 'Evento realtime/projection invalido.', event.id || 'event-unknown'));
      }
    });

    return {
      score: score(Math.max(items.length + (context.realtimeEvents?.length ?? 0), 1), issues.length),
      brokenReferences: issues.filter((issue) => issue.code === 'BROKEN_REFERENCE').length,
      orphanData: issues.filter((issue) => issue.code === 'ORPHAN_DATA').length,
      missingRegions: issues.filter((issue) => issue.code === 'REGION_NOT_FOUND').length,
      missingMedia: issues.filter((issue) => issue.code === 'MEDIA_NOT_FOUND').length,
      projectionsWithoutSource: issues.filter((issue) => issue.code === 'PROJECTION_WITHOUT_SOURCE').length,
      inconsistentSnapshots: issues.filter((issue) => issue.code === 'SNAPSHOT_INCONSISTENT').length,
      invalidRealtimeEvents: issues.filter((issue) => issue.code === 'REALTIME_EVENT_INVALID').length,
      issues,
    };
  }
}
