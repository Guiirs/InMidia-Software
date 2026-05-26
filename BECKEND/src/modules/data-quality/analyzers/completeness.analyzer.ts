import type {
  DataCompletenessResult,
  DataQualityContext,
  DataQualityIssue,
} from '../contracts/data-quality.contracts';
import { createIssue } from '../diagnostics/data-quality.issue-factory';

function score(total: number, issues: number): number {
  if (total <= 0) return issues > 0 ? 50 : 100;
  return Math.max(0, Math.round(100 - (issues / total) * 100));
}

export class CompletenessAnalyzer {
  analyze(context: DataQualityContext): DataCompletenessResult {
    const items = context.snapshot?.inventory.items ?? [];
    const publicItems = context.publicInventory ?? [];
    const mediaAssets = context.mediaAssets ?? [];
    const issues: DataQualityIssue[] = [];

    items.forEach((item) => {
      if (!item.coordinates) {
        issues.push(createIssue('MISSING_COORDINATES', 'geo', 'high', 'Placa sem coordenada valida.', item.placaId));
      }
      if (!item.numeroOperacional) {
        issues.push(createIssue('MISSING_OPERATIONAL_NUMBER', 'operational', 'medium', 'Placa sem numero operacional.', item.placaId));
      }
      if (!item.regiaoId) {
        issues.push(createIssue('MISSING_REGION', 'territorial', 'high', 'Placa sem regiao vinculada.', item.placaId));
      }
      if (!item.numeroPlaca) {
        issues.push(createIssue('REQUIRED_DATA_MISSING', 'structural', 'medium', 'Placa sem numero cadastral publico.', item.placaId));
      }
    });

    publicItems.forEach((item) => {
      if (!item.media) {
        issues.push(createIssue('MISSING_MEDIA', 'media', 'medium', 'Item publico sem midia associada.', item.id));
      }
    });

    mediaAssets.forEach((asset) => {
      if (asset.metadata.partial) {
        issues.push(createIssue('INCOMPLETE_METADATA', 'media', 'low', 'Metadata de midia incompleta.', asset.id));
      }
    });

    if (context.snapshot?.metadata.partial || context.snapshot?.spatial.status === 'partial') {
      issues.push(createIssue('INCOMPLETE_PROJECTION', 'structural', 'medium', 'Projection snapshot marcado como parcial.', context.snapshot.metadata.projectionId));
    }

    return {
      score: score(Math.max(items.length + publicItems.length + mediaAssets.length, 1), issues.length),
      missingCoordinates: issues.filter((issue) => issue.code === 'MISSING_COORDINATES').length,
      missingMedia: issues.filter((issue) => issue.code === 'MISSING_MEDIA').length,
      missingOperationalNumber: issues.filter((issue) => issue.code === 'MISSING_OPERATIONAL_NUMBER').length,
      missingRegion: issues.filter((issue) => issue.code === 'MISSING_REGION').length,
      missingRequiredData: issues.filter((issue) => issue.code === 'REQUIRED_DATA_MISSING').length,
      incompleteMetadata: issues.filter((issue) => issue.code === 'INCOMPLETE_METADATA').length,
      incompleteProjections: issues.filter((issue) => issue.code === 'INCOMPLETE_PROJECTION').length,
      issues,
    };
  }
}
