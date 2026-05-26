import type { DataQualitySnapshot } from '@modules/data-quality';
import type { GeoIntelligenceSnapshot } from '@modules/geo-intelligence';
import type { GovernanceDecisionType, GovernanceSnapshot } from '@modules/governance';
import type { ProjectionSnapshot } from '@modules/projections';

export type AnalyticsSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnalyticsSignalType =
  | 'analytics.occupancy.high'
  | 'analytics.quality.degraded'
  | 'analytics.region.saturated'
  | 'analytics.region.underutilized'
  | 'analytics.media.low'
  | 'analytics.governance.warning';
export type AnalyticsMetricCategory = 'inventory' | 'occupancy' | 'availability' | 'territorial' | 'quality' | 'governance' | 'media';
export type AnalyticsMetricUnit = 'count' | 'percent' | 'score';
export type AnalyticsTrendDirection = 'up' | 'down' | 'stable';

export interface OperationalAnalyticsContext {
  projectionSnapshot: ProjectionSnapshot;
  geoSnapshot?: GeoIntelligenceSnapshot;
  qualitySnapshot?: DataQualitySnapshot;
  governanceSnapshot?: GovernanceSnapshot;
  knownRegionIds?: string[];
  generatedBy?: string;
  now?: Date;
}

export interface AnalyticsKPI {
  key: string;
  label: string;
  value: number;
  unit: AnalyticsMetricUnit;
  category: AnalyticsMetricCategory;
  description: string;
}

export interface AnalyticsMetric {
  key: string;
  label: string;
  value: number;
  unit: AnalyticsMetricUnit;
  category: AnalyticsMetricCategory;
  regionId?: string;
  meta?: Record<string, unknown>;
}

export interface AnalyticsTrend {
  key: string;
  label: string;
  direction: AnalyticsTrendDirection;
  severity: AnalyticsSeverity;
  message: string;
  delta: number;
  currentValue: number;
  previousValue: number;
}

export interface AnalyticsSignal {
  id: string;
  type: AnalyticsSignalType;
  severity: AnalyticsSeverity;
  message: string;
  emittedAt: string;
  regionId?: string;
  meta?: Record<string, unknown>;
}

export interface AnalyticsRegionSummary {
  regionId: string;
  empresaId?: string;
  tenantId?: string;
  totalPlacas: number;
  placasAtivas: number;
  occupied: number;
  available: number;
  reserved: number;
  unavailable: number;
  unknown: number;
  conflicts: number;
  incomplete: number;
  occupancyRate: number;
  availabilityRate: number;
  qualityScore: number;
  governanceScore: number;
  density: number;
  saturated: boolean;
  underutilized: boolean;
  coverageStatus: 'covered' | 'uncovered' | 'unknown';
}

export interface AnalyticsOccupancySummary {
  totalPlacas: number;
  placasAtivas: number;
  occupied: number;
  reserved: number;
  available: number;
  unavailable: number;
  unknown: number;
  occupancyRate: number;
  saturatedRegions: string[];
  underutilizedRegions: string[];
}

export interface AnalyticsAvailabilitySummary {
  totalPlacas: number;
  available: number;
  unavailable: number;
  unknown: number;
  availabilityRate: number;
  lowAvailabilityRegionIds: string[];
  highAvailabilityRegionIds: string[];
}

export interface AnalyticsQualitySummary {
  globalScore: number;
  geoScore: number;
  inventoryScore: number;
  mediaScore: number;
  operationalScore: number;
  averageTerritorialQuality: number;
  totalIssues: number;
  degraded: boolean;
  conflicts: number;
}

export interface AnalyticsGovernanceSummary {
  averageScore: number;
  decision: GovernanceDecisionType | 'unknown';
  totalViolations: number;
  highestSeverity: AnalyticsSeverity | null;
  requiresReview: boolean;
  bySeverity: Record<AnalyticsSeverity, number>;
}

export interface AnalyticsSummary {
  totalPlacas: number;
  placasAtivas: number;
  occupancyRate: number;
  availabilityRate: number;
  coveredRegions: number;
  saturatedRegions: number;
  underutilizedRegions: number;
  averageQuality: number;
  averageGovernance: number;
  territorialQuality: number;
  operationalDensity: number;
  totalSignals: number;
}

export interface AnalyticsAggregations {
  byRegion: Record<string, AnalyticsRegionSummary>;
  byEmpresa: Record<string, number>;
  byTenant: Record<string, number>;
  byAvailability: Record<'available' | 'reserved' | 'occupied' | 'unavailable' | 'unknown', number>;
  byOccupancy: Record<'occupied' | 'unoccupied' | 'reserved' | 'conflicts', number>;
  byQuality: Record<'healthy' | 'degraded' | 'averageScore', number>;
  byConflicts: Record<'total' | 'regionsWithConflicts', number>;
  byGovernance: Record<'allow' | 'warn' | 'review' | 'deny' | 'unknown' | 'averageScore', number>;
}

export interface AnalyticsSnapshot {
  id: string;
  tenantId?: string;
  generatedAt: string;
  sourceProjectionId: string;
  sourceProjectionVersion: number;
  context: {
    generatedBy?: string;
    knownRegions: number;
  };
  kpis: AnalyticsKPI[];
  metrics: AnalyticsMetric[];
  trends: AnalyticsTrend[];
  signals: AnalyticsSignal[];
  regions: AnalyticsRegionSummary[];
  occupancy: AnalyticsOccupancySummary;
  availability: AnalyticsAvailabilitySummary;
  quality: AnalyticsQualitySummary;
  governance: AnalyticsGovernanceSummary;
  summary: AnalyticsSummary;
  aggregations: AnalyticsAggregations;
}