import type { EnterpriseBIDataset, EnterpriseBIRecord, EnterpriseBIVisibility } from '../contracts/enterprise-bi.contracts';

export interface EnterpriseBIPresentationRow {
  label: string;
  regiaoId?: string;
  empresaId?: string;
  availability?: EnterpriseBIRecord['availability'];
  occupancyRate?: number;
  qualityScore?: number;
  governanceScore?: number;
  severity?: EnterpriseBIRecord['severity'];
  mediaValid?: boolean;
  metrics: Array<{ key: string; label: string; value: number; unit: string; category: string }>;
}

export interface EnterpriseBIPresentation {
  id: string;
  name: string;
  grain: EnterpriseBIDataset['grain'];
  profile: EnterpriseBIDataset['profile'];
  visibility: EnterpriseBIVisibility;
  rowCount: number;
  completeness: EnterpriseBIDataset['completeness'];
  metrics: EnterpriseBIDataset['metrics'];
  rows: EnterpriseBIPresentationRow[];
}

function sanitizeMetrics(metrics: EnterpriseBIRecord['metrics']) {
  return metrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    value: metric.value,
    unit: metric.unit,
    category: metric.category,
  }));
}

function sanitizeRows(dataset: EnterpriseBIDataset, allowed: Array<keyof EnterpriseBIPresentationRow>): EnterpriseBIPresentationRow[] {
  return dataset.rows.map((row) => {
    const presentation: EnterpriseBIPresentationRow = { label: row.label, metrics: sanitizeMetrics(row.metrics) };

    if (allowed.includes('regiaoId')) presentation.regiaoId = row.regiaoId;
    if (allowed.includes('empresaId')) presentation.empresaId = row.empresaId;
    if (allowed.includes('availability')) presentation.availability = row.availability;
    if (allowed.includes('occupancyRate')) presentation.occupancyRate = row.occupancyRate;
    if (allowed.includes('qualityScore')) presentation.qualityScore = row.qualityScore;
    if (allowed.includes('governanceScore')) presentation.governanceScore = row.governanceScore;
    if (allowed.includes('severity')) presentation.severity = row.severity;
    if (allowed.includes('mediaValid')) presentation.mediaValid = row.mediaValid;

    return presentation;
  });
}

abstract class BaseBIPresenter {
  protected abstract readonly allowedFields: Array<keyof EnterpriseBIPresentationRow>;

  present(dataset: EnterpriseBIDataset): EnterpriseBIPresentation {
    return {
      id: dataset.id,
      name: dataset.name,
      grain: dataset.grain,
      profile: dataset.profile,
      visibility: dataset.visibility,
      rowCount: dataset.rowCount,
      completeness: dataset.completeness,
      metrics: dataset.metrics,
      rows: sanitizeRows(dataset, this.allowedFields),
    };
  }
}

export class ExecutiveBIPresenter extends BaseBIPresenter {
  protected readonly allowedFields: Array<keyof EnterpriseBIPresentationRow> = ['occupancyRate', 'qualityScore', 'governanceScore', 'mediaValid'];
}

export class RegionalBIPresenter extends BaseBIPresenter {
  protected readonly allowedFields: Array<keyof EnterpriseBIPresentationRow> = ['regiaoId', 'occupancyRate', 'qualityScore', 'governanceScore', 'severity', 'availability'];
}

export class InventoryBIPresenter extends BaseBIPresenter {
  protected readonly allowedFields: Array<keyof EnterpriseBIPresentationRow> = ['regiaoId', 'empresaId', 'availability', 'occupancyRate', 'qualityScore', 'severity', 'mediaValid'];
}

export class QualityBIPresenter extends BaseBIPresenter {
  protected readonly allowedFields: Array<keyof EnterpriseBIPresentationRow> = ['regiaoId', 'qualityScore', 'severity'];
}

export class GovernanceBIPresenter extends BaseBIPresenter {
  protected readonly allowedFields: Array<keyof EnterpriseBIPresentationRow> = ['regiaoId', 'governanceScore', 'severity'];
}
