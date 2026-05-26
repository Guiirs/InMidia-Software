import type { GeoIntelligenceSnapshot } from '@modules/geo-intelligence';
import type { InventoryItem } from '@modules/inventory';
import type { MediaAsset } from '@modules/media';
import type { ProjectionEvent, ProjectionSnapshot } from '@modules/projections';
import type { PublicInventoryItem } from '@modules/public-api';

export type DataQualitySeverity = 'low' | 'medium' | 'high' | 'critical';
export type DataQualityCategory =
  | 'geo'
  | 'inventory'
  | 'media'
  | 'operational'
  | 'structural'
  | 'availability'
  | 'territorial'
  | 'consistency';

export type DataQualitySignalType =
  | 'data-quality.degraded'
  | 'geo-quality.low'
  | 'inventory-quality.low'
  | 'media-quality.invalid'
  | 'projection.integrity.failed'
  | 'territorial.consistency.warning';

export interface DataQualityContext {
  snapshot?: ProjectionSnapshot;
  geoSnapshot?: GeoIntelligenceSnapshot;
  publicInventory?: PublicInventoryItem[];
  mediaAssets?: MediaAsset[];
  realtimeEvents?: ProjectionEvent[];
  knownRegionIds?: string[];
  generatedBy?: string;
  now?: Date;
}

export interface DataQualityScore {
  global: number;
  geo: number;
  inventory: number;
  media: number;
  operational: number;
}

export interface DataQualityIssue {
  id: string;
  code:
    | 'MISSING_COORDINATES'
    | 'MISSING_MEDIA'
    | 'MISSING_OPERATIONAL_NUMBER'
    | 'MISSING_REGION'
    | 'REQUIRED_DATA_MISSING'
    | 'INCOMPLETE_METADATA'
    | 'INCOMPLETE_PROJECTION'
    | 'AVAILABILITY_MISMATCH'
    | 'TERRITORIAL_CONFLICT'
    | 'OPERATIONAL_INCONSISTENCY'
    | 'IMPOSSIBLE_STATUS'
    | 'DUPLICATED_OPERATIONAL_NUMBER'
    | 'INVALID_MEDIA'
    | 'PROJECTION_DIVERGENCE'
    | 'INVENTORY_PROJECTION_MISMATCH'
    | 'BROKEN_REFERENCE'
    | 'ORPHAN_DATA'
    | 'REGION_NOT_FOUND'
    | 'MEDIA_NOT_FOUND'
    | 'PROJECTION_WITHOUT_SOURCE'
    | 'SNAPSHOT_INCONSISTENT'
    | 'REALTIME_EVENT_INVALID';
  category: DataQualityCategory;
  severity: DataQualitySeverity;
  message: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export interface DataQualitySignal {
  id: string;
  type: DataQualitySignalType;
  severity: DataQualitySeverity;
  message: string;
  emittedAt: string;
  meta?: Record<string, unknown>;
}

export interface DataCompletenessResult {
  score: number;
  missingCoordinates: number;
  missingMedia: number;
  missingOperationalNumber: number;
  missingRegion: number;
  missingRequiredData: number;
  incompleteMetadata: number;
  incompleteProjections: number;
  issues: DataQualityIssue[];
}

export interface DataConsistencyResult {
  score: number;
  availabilityMismatches: number;
  territorialConflicts: number;
  operationalInconsistencies: number;
  impossibleStatuses: number;
  duplicatedOperationalNumbers: number;
  invalidMedia: number;
  projectionDivergences: number;
  inventoryProjectionMismatches: number;
  issues: DataQualityIssue[];
}

export interface DataIntegrityResult {
  score: number;
  brokenReferences: number;
  orphanData: number;
  missingRegions: number;
  missingMedia: number;
  projectionsWithoutSource: number;
  inconsistentSnapshots: number;
  invalidRealtimeEvents: number;
  issues: DataQualityIssue[];
}

export interface DataQualitySnapshot {
  score: DataQualityScore;
  completeness: DataCompletenessResult;
  consistency: DataConsistencyResult;
  integrity: DataIntegrityResult;
  issues: DataQualityIssue[];
  signals: DataQualitySignal[];
  summary: DataQualitySummary;
  generatedAt: string;
  sourceProjectionId?: string;
  sourceProjectionVersion?: number;
}

export interface DataQualitySummary {
  totalIssues: number;
  bySeverity: Record<DataQualitySeverity, number>;
  byCategory: Record<DataQualityCategory, number>;
  degraded: boolean;
  highestSeverity: DataQualitySeverity | null;
}

export interface DataQualityResult {
  ok: boolean;
  snapshot?: DataQualitySnapshot;
  error?: string;
}

export function inventoryItemsFromContext(context: DataQualityContext): InventoryItem[] {
  return context.snapshot?.inventory.items ?? [];
}
