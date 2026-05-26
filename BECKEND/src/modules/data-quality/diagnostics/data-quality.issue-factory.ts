import type {
  DataQualityCategory,
  DataQualityIssue,
  DataQualityIssue as Issue,
  DataQualitySeverity,
} from '../contracts/data-quality.contracts';

export function createIssue(
  code: Issue['code'],
  category: DataQualityCategory,
  severity: DataQualitySeverity,
  message: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): DataQualityIssue {
  return {
    id: `${code}:${entityId ?? 'global'}:${JSON.stringify(meta ?? {})}`,
    code,
    category,
    severity,
    message,
    entityId,
    meta,
  };
}

export function severityRank(severity: DataQualitySeverity): number {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}
