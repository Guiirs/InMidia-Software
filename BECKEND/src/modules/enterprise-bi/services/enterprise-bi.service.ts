import crypto from 'crypto';
import logger from '@shared/container/logger';
import { EnterpriseBIDatasetFactory } from '../datasets/enterprise-bi.dataset-factory';
import { applyEnterpriseBIFilters } from '../filters/enterprise-bi.filter';
import { localEnterpriseBISnapshotStore, type EnterpriseBISnapshotStore } from '../stores/enterprise-bi.snapshot-store';
import type {
  EnterpriseBIContext,
  EnterpriseBIDataset,
  EnterpriseBIQuery,
  EnterpriseBIQueryResult,
  EnterpriseBIRecord,
  EnterpriseBISnapshot,
  EnterpriseBISnapshotSummary,
} from '../contracts/enterprise-bi.contracts';

export class EnterpriseBIService {
  constructor(
    private readonly snapshotStore: EnterpriseBISnapshotStore = localEnterpriseBISnapshotStore,
    private readonly datasetFactory = new EnterpriseBIDatasetFactory(),
  ) {}

  buildBISnapshot(context: EnterpriseBIContext): EnterpriseBISnapshot {
    const datasets = this.datasetFactory.buildCompleteDatasets(context);
    const summary = this.buildSnapshotSummary(context, datasets);
    const snapshot: EnterpriseBISnapshot = {
      id: crypto.randomUUID(),
      tenantId: context.tenantId ?? context.operationalAnalyticsSnapshot.tenantId,
      empresaId: context.empresaId,
      regiaoId: context.regiaoId,
      generatedAt: (context.now ?? new Date()).toISOString(),
      sourceOperationalAnalyticsSnapshotId: context.operationalAnalyticsSnapshot.id,
      sourceProjectionId: context.projectionSnapshot.metadata.projectionId,
      sourceProjectionVersion: context.projectionSnapshot.metadata.version,
      grain: context.grain ?? 'global',
      exportProfile: context.profile ?? 'executive-summary',
      visibility: context.visibility ?? 'internal',
      datasets,
      metrics: datasets.flatMap((dataset) => dataset.metrics),
      summary,
      generatedBy: context.generatedBy,
    };

    this.snapshotStore.save(snapshot, snapshot.tenantId);

    logger.info('[EnterpriseBI] Snapshot created', {
      tenantId: snapshot.tenantId,
      grain: snapshot.grain,
      profile: snapshot.exportProfile,
      datasets: snapshot.summary.datasetCount,
      rows: snapshot.summary.rowCount,
    });

    if (snapshot.summary.incompleteDatasets > 0) {
      logger.warn('[EnterpriseBI] Dataset incomplete', {
        tenantId: snapshot.tenantId,
        incompleteDatasets: snapshot.summary.incompleteDatasets,
      });
    }

    if (snapshot.summary.hasSensitiveData) {
      logger.warn('[EnterpriseBI] Sensitive exposure blocked', {
        tenantId: snapshot.tenantId,
        blockedSensitiveFields: snapshot.summary.blockedSensitiveFields,
      });
    }

    return snapshot;
  }

  buildExecutiveDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    return this.datasetFactory.buildExecutiveDataset(context);
  }

  buildRegionalDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    return this.datasetFactory.buildRegionalDataset(context);
  }

  buildInventoryDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    return this.datasetFactory.buildInventoryDataset(context);
  }

  buildQualityDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    return this.datasetFactory.buildQualityDataset(context);
  }

  buildGovernanceDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    return this.datasetFactory.buildGovernanceDataset(context);
  }

  queryDataset(query: EnterpriseBIQuery): EnterpriseBIQueryResult {
    const snapshot = this.snapshotStore.getLatest({ grain: query.grain }) ?? this.snapshotStore.getLatest();

    if (!snapshot) {
      return this.buildBIResult(query, undefined, [], 'Nenhum snapshot BI disponivel.');
    }

    const dataset = this.resolveDataset(snapshot, query);
    if (!dataset) {
      return this.buildBIResult(query, undefined, [], 'Dataset BI nao encontrado.', snapshot.id);
    }

    const filteredRows = this.applyBIFilters(query, dataset.rows);
    logger.info('[EnterpriseBI] Query executed', {
      snapshotId: snapshot.id,
      datasetId: dataset.id,
      filters: query.filters?.length ?? 0,
      totalRows: dataset.rows.length,
      returnedRows: filteredRows.length,
    });

    return this.buildBIResult(query, dataset, filteredRows, undefined, snapshot.id);
  }

  applyBIFilters(query: EnterpriseBIQuery, rows: EnterpriseBIRecord[]): EnterpriseBIRecord[] {
    if ((query.filters?.length ?? 0) > 0) {
      logger.info('[EnterpriseBI] Filters applied', {
        filters: query.filters?.map((filter) => filter.field),
      });
    }

    return applyEnterpriseBIFilters(rows, query);
  }

  buildBIResult(
    query: EnterpriseBIQuery,
    dataset?: EnterpriseBIDataset,
    rows: EnterpriseBIRecord[] = [],
    error?: string,
    snapshotId?: string,
  ): EnterpriseBIQueryResult {
    const totalRows = dataset?.rows.length ?? 0;
    const limit = query.limit ?? rows.length;
    const offset = query.offset ?? 0;
    const paginated = rows.slice(offset, offset + limit);

    return {
      ok: !error,
      snapshotId,
      dataset,
      rows: paginated,
      totalRows,
      returnedRows: paginated.length,
      summary: {
        datasetId: dataset?.id ?? query.datasetId ?? 'unknown',
        grain: dataset?.grain ?? query.grain ?? 'global',
        profile: dataset?.profile ?? query.profile ?? 'executive-summary',
        appliedFilters: query.filters?.length ?? 0,
        completeness: dataset?.completeness ?? 'partial',
      },
      error,
    };
  }

  private resolveDataset(snapshot: EnterpriseBISnapshot, query: EnterpriseBIQuery): EnterpriseBIDataset | undefined {
    if (query.datasetId) {
      return snapshot.datasets.find((dataset) => dataset.id === query.datasetId);
    }

    if (query.profile) {
      return snapshot.datasets.find((dataset) => dataset.profile === query.profile && (!query.grain || dataset.grain === query.grain));
    }

    return snapshot.datasets.find((dataset) => dataset.grain === (query.grain ?? snapshot.grain)) ?? snapshot.datasets[0];
  }

  private buildSnapshotSummary(context: EnterpriseBIContext, datasets: EnterpriseBIDataset[]): EnterpriseBISnapshotSummary {
    const rowCount = datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
    const incompleteDatasets = datasets.filter((dataset) => dataset.completeness === 'partial').length;
    const blockedSensitiveFields = datasets.reduce((sum, dataset) => sum + dataset.rows.filter((row) => Boolean(row.meta?.sensitive || row.meta?.private || row.meta?.adminOnly)).length, 0);

    return {
      datasetCount: datasets.length,
      rowCount,
      incompleteDatasets,
      blockedSensitiveFields,
      hasSensitiveData: blockedSensitiveFields > 0,
      exportedProfile: context.profile ?? 'executive-summary',
      grain: context.grain ?? 'global',
      visibility: context.visibility ?? 'internal',
    };
  }
}

export const enterpriseBiService = new EnterpriseBIService();
