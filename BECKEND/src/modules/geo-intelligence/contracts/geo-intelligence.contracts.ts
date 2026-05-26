import type { ProjectionSnapshot } from '@modules/projections';
import type { GeoPoint } from '@modules/spatial';

export type GeoInsightStatus = 'complete' | 'partial' | 'unknown';
export type GeoOpportunityType = 'expansion' | 'sales' | 'maintenance' | 'data-quality' | 'operational-review';
export type GeoRiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type GeoRiskType =
  | 'missing-coordinates'
  | 'operational-duplicates'
  | 'no-availability'
  | 'excessive-concentration'
  | 'operational-conflicts'
  | 'low-data-quality';

export interface GeoIntelligenceContext {
  snapshot: ProjectionSnapshot;
  knownRegionIds?: string[];
  regionAreasKm2?: Record<string, number>;
  generatedBy?: string;
  now?: Date;
}

export interface GeoCoverageSummary {
  totalItems: number;
  validCoordinateCount: number;
  missingCoordinateCount: number;
  coveredRegionIds: string[];
  uncoveredRegionIds: string[];
  coveragePercent: number;
  territorialCoveragePercent: number | null;
  pointsOutsideRegionCount: number;
  status: GeoInsightStatus;
}

export interface GeoDensityRegion {
  regionId: string;
  count: number;
  relativeDensity: number;
  densityPerKm2?: number;
}

export interface GeoDensityResult {
  mode: 'relative' | 'area';
  regions: GeoDensityRegion[];
  highConcentrationRegionIds: string[];
  lowConcentrationRegionIds: string[];
  concentrationIndex: number;
  status: GeoInsightStatus;
}

export interface GeoOccupancyInsight {
  regionId: string;
  total: number;
  occupied: number;
  available: number;
  reserved: number;
  unavailable: number;
  conflicts: number;
  incomplete: number;
  occupancyRate: number;
  availabilityRate: number;
  saturated: boolean;
  underutilized: boolean;
}

export interface GeoAvailabilityInsight {
  regionId: string;
  available: number;
  unavailable: number;
  unknown: number;
  availabilityRate: number;
  status: GeoInsightStatus;
}

export interface GeoRegionScore {
  regionId: string;
  score: number;
  coverageScore: number;
  availabilityScore: number;
  occupancyScore: number;
  qualityScore: number;
  status: GeoInsightStatus;
}

export interface GeoOpportunity {
  id: string;
  type: GeoOpportunityType;
  regionId?: string;
  title: string;
  reason: string;
  score: number;
  meta?: Record<string, unknown>;
}

export interface GeoRiskSignal {
  id: string;
  type: GeoRiskType;
  severity: GeoRiskSeverity;
  regionId?: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface GeoIntelligenceSnapshot {
  coverage: GeoCoverageSummary;
  density: GeoDensityResult;
  occupancy: GeoOccupancyInsight[];
  availability: GeoAvailabilityInsight[];
  regionScores: GeoRegionScore[];
  opportunities: GeoOpportunity[];
  risks: GeoRiskSignal[];
  generatedAt: string;
  sourceProjectionId: string;
  sourceProjectionVersion: number;
}

export interface GeoIntelligenceResult {
  ok: boolean;
  snapshot?: GeoIntelligenceSnapshot;
  error?: string;
}

export interface RegionPointBucket {
  regionId: string;
  points: GeoPoint[];
}
