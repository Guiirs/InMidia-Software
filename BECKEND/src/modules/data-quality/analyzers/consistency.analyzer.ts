import type {
  DataConsistencyResult,
  DataQualityContext,
  DataQualityIssue,
} from '../contracts/data-quality.contracts';
import { createIssue } from '../diagnostics/data-quality.issue-factory';

function score(total: number, issues: number): number {
  if (total <= 0) return issues > 0 ? 50 : 100;
  return Math.max(0, Math.round(100 - (issues / total) * 100));
}

export class ConsistencyAnalyzer {
  analyze(context: DataQualityContext): DataConsistencyResult {
    const items = context.snapshot?.inventory.items ?? [];
    const dashboard = context.snapshot?.dashboard;
    const issues: DataQualityIssue[] = [];
    const operationalByRegion = new Map<string, Set<number>>();

    items.forEach((item) => {
      if (item.availability.status !== item.status.commercial) {
        issues.push(createIssue('AVAILABILITY_MISMATCH', 'availability', 'high', 'Availability diverge do estado comercial.', item.placaId));
      }

      if (item.status.physical === 'removed' && item.status.commercial === 'available') {
        issues.push(createIssue('IMPOSSIBLE_STATUS', 'consistency', 'critical', 'Status fisico removido nao pode estar disponivel.', item.placaId));
      }

      if (item.status.operational === 'conflict' || item.conflicts.length > 0) {
        issues.push(createIssue('OPERATIONAL_INCONSISTENCY', 'operational', 'medium', 'Inventario possui conflito operacional.', item.placaId, {
          conflicts: item.conflicts.map((conflict) => conflict.code),
        }));
      }

      if (item.regiaoId && item.numeroOperacional) {
        const regionSet = operationalByRegion.get(item.regiaoId) ?? new Set<number>();
        if (regionSet.has(item.numeroOperacional)) {
          issues.push(createIssue('DUPLICATED_OPERATIONAL_NUMBER', 'operational', 'high', 'Numero operacional duplicado na mesma regiao.', item.placaId, {
            regiaoId: item.regiaoId,
            numeroOperacional: item.numeroOperacional,
          }));
        }
        regionSet.add(item.numeroOperacional);
        operationalByRegion.set(item.regiaoId, regionSet);
      }
    });

    if (dashboard && dashboard.totalPlacas !== items.length) {
      issues.push(createIssue('INVENTORY_PROJECTION_MISMATCH', 'consistency', 'high', 'Total do dashboard diverge do inventario projetado.', context.snapshot?.metadata.projectionId, {
        dashboardTotal: dashboard.totalPlacas,
        inventoryTotal: items.length,
      }));
    }

    if (context.snapshot && context.snapshot.spatial.points.length + context.snapshot.spatial.invalidPointIds.length > items.length) {
      issues.push(createIssue('PROJECTION_DIVERGENCE', 'consistency', 'medium', 'Projection espacial possui mais pontos que o inventario.', context.snapshot.metadata.projectionId));
    }

    (context.mediaAssets ?? []).forEach((asset) => {
      if (asset.status === 'invalid' || asset.status === 'failed') {
        issues.push(createIssue('INVALID_MEDIA', 'media', 'medium', 'Midia invalida ou com falha de processamento.', asset.id));
      }
    });

    const geoRisks = context.geoSnapshot?.risks ?? [];
    geoRisks.forEach((risk) => {
      if (risk.type === 'operational-duplicates' || risk.type === 'excessive-concentration') {
        issues.push(createIssue('TERRITORIAL_CONFLICT', 'territorial', risk.severity, risk.message, risk.regionId, { riskType: risk.type }));
      }
    });

    return {
      score: score(Math.max(items.length, 1), issues.length),
      availabilityMismatches: issues.filter((issue) => issue.code === 'AVAILABILITY_MISMATCH').length,
      territorialConflicts: issues.filter((issue) => issue.code === 'TERRITORIAL_CONFLICT').length,
      operationalInconsistencies: issues.filter((issue) => issue.code === 'OPERATIONAL_INCONSISTENCY').length,
      impossibleStatuses: issues.filter((issue) => issue.code === 'IMPOSSIBLE_STATUS').length,
      duplicatedOperationalNumbers: issues.filter((issue) => issue.code === 'DUPLICATED_OPERATIONAL_NUMBER').length,
      invalidMedia: issues.filter((issue) => issue.code === 'INVALID_MEDIA').length,
      projectionDivergences: issues.filter((issue) => issue.code === 'PROJECTION_DIVERGENCE').length,
      inventoryProjectionMismatches: issues.filter((issue) => issue.code === 'INVENTORY_PROJECTION_MISMATCH').length,
      issues,
    };
  }
}
