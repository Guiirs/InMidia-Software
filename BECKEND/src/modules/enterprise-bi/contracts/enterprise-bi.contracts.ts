import type { DataQualitySnapshot } from '@modules/data-quality';
import type { GeoIntelligenceSnapshot } from '@modules/geo-intelligence';
import type { GovernanceSnapshot } from '@modules/governance';
import type { AnalyticsSnapshot } from '@modules/operational-analytics';
import type { ProjectionSnapshot } from '@modules/projections';

export type EnterpriseBIGrain = 'global' | 'tenant' | 'empresa' | 'regiao' | 'placa' | 'periodo';
export type EnterpriseBIVisibility = 'internal' | 'executive' | 'restricted';
export type EnterpriseBIExportProfile =
  | 'executive-summary'
  | 'regional-performance'
  | 'inventory-health'
  | 'quality-report'
  | 'governance-report';
export type EnterpriseBISeverity = 'low' | 'medium' | 'high' | 'critical';
export type EnterpriseBIFilterOperator = 'eq' | 'ne' | 'in' | 'gte' | 'lte' | 'between' | 'contains' | 'exists';
export type EnterpriseBIFilterField =
  | 'tenantId'
  | 'empresaId'
  | 'regiaoId'
  | 'placaId'
  | 'status'
  | 'availability'
  | 'occupancyRate'
  | 'qualityScore'
  | 'severity'
  | 'mediaValid'
  | 'periodStart'
  | 'periodEnd'
  | 'grain'
  | 'profile';

export interface EnterpriseBIContext {
  operationalAnalyticsSnapshot: AnalyticsSnapshot;
  projectionSnapshot: ProjectionSnapshot;
  geoSnapshot?: GeoIntelligenceSnapshot;
  qualitySnapshot?: DataQualitySnapshot;
  governanceSnapshot?: GovernanceSnapshot;
  tenantId?: string;
  empresaId?: string;
  regiaoId?: string;
  period?: {
    start?: string;
    end?: string;
  };
  grain?: EnterpriseBIGrain;
  profile?: EnterpriseBIExportProfile;
  visibility?: EnterpriseBIVisibility;
  generatedBy?: string;
  now?: Date;
}

export interface EnterpriseBIMetric {
  key: string;
  label: string;
  value: number;
  unit: 'count' | 'percent' | 'score' | 'ratio' | 'days';
  category: 'inventory' | 'availability' | 'occupancy' | 'quality' | 'governance' | 'geo' | 'media' | 'executive';
  grain: EnterpriseBIGrain;
  meta?: Record<string, unknown>;
}

export interface EnterpriseBIFilter {
  field: EnterpriseBIFilterField;
  operator: EnterpriseBIFilterOperator;
  value?: string | number | boolean | Array<string | number> | { start?: string; end?: string };
}

export interface EnterpriseBIQuery {
  datasetId?: string;
  grain?: EnterpriseBIGrain;
  profile?: EnterpriseBIExportProfile;
  filters?: EnterpriseBIFilter[];
  limit?: number;
  offset?: number;
  sortBy?: keyof EnterpriseBIRecord;
  sortDirection?: 'asc' | 'desc';
}

export interface EnterpriseBIRecord {
  id: string;
  grain: EnterpriseBIGrain;
  profile: EnterpriseBIExportProfile;
  visibility: EnterpriseBIVisibility;
  label: string;
  tenantId?: string;
  empresaId?: string;
  regiaoId?: string;
  placaId?: string;
  status?: string;
  availability?: 'available' | 'reserved' | 'occupied' | 'unavailable' | 'unknown';
  occupancyRate?: number;
  qualityScore?: number;
  governanceScore?: number;
  severity?: EnterpriseBISeverity;
  mediaValid?: boolean;
  period?: {
    start?: string;
    end?: string;
  };
  metrics: EnterpriseBIMetric[];
  meta?: Record<string, unknown>;
}

export interface EnterpriseBIDataset {
  id: string;
  name: string;
  description: string;
  grain: EnterpriseBIGrain;
  profile: EnterpriseBIExportProfile;
  visibility: EnterpriseBIVisibility;
  generatedAt: string;
  rowCount: number;
  metrics: EnterpriseBIMetric[];
  rows: EnterpriseBIRecord[];
  filtersApplied: EnterpriseBIFilter[];
  completeness: 'complete' | 'partial';
  source: {
    operationalAnalyticsSnapshotId: string;
    projectionSnapshotId: string;
    geoSnapshotId?: string;
    qualitySnapshotId?: string;
    governanceSnapshotId?: string;
  };
}

export interface EnterpriseBIExportProfileSpec {
  profile: EnterpriseBIExportProfile;
  grain: EnterpriseBIGrain;
  visibility: EnterpriseBIVisibility;
  datasets: string[];
  description: string;
}

export interface EnterpriseBISnapshotSummary {
  datasetCount: number;
  rowCount: number;
  incompleteDatasets: number;
  blockedSensitiveFields: number;
  hasSensitiveData: boolean;
  exportedProfile: EnterpriseBIExportProfile;
  grain: EnterpriseBIGrain;
  visibility: EnterpriseBIVisibility;
}

export interface EnterpriseBISnapshot {
  id: string;
  tenantId?: string;
  empresaId?: string;
  regiaoId?: string;
  generatedAt: string;
  sourceOperationalAnalyticsSnapshotId: string;
  sourceProjectionId: string;
  sourceProjectionVersion: number;
  grain: EnterpriseBIGrain;
  exportProfile: EnterpriseBIExportProfile;
  visibility: EnterpriseBIVisibility;
  datasets: EnterpriseBIDataset[];
  metrics: EnterpriseBIMetric[];
  summary: EnterpriseBISnapshotSummary;
  generatedBy?: string;
}

export interface EnterpriseBIQueryResult {
  ok: boolean;
  snapshotId?: string;
  dataset?: EnterpriseBIDataset;
  rows: EnterpriseBIRecord[];
  totalRows: number;
  returnedRows: number;
  summary: {
    datasetId: string;
    grain: EnterpriseBIGrain;
    profile: EnterpriseBIExportProfile;
    appliedFilters: number;
    completeness: 'complete' | 'partial';
  };
  error?: string;
}

export interface EnterpriseBIResult {
  ok: boolean;
  snapshot?: EnterpriseBISnapshot;
  query?: EnterpriseBIQueryResult;
  error?: string;
}
