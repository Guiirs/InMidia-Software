import type { DataQualitySnapshot } from '@modules/data-quality';
import type { ProjectionSnapshot } from '@modules/projections';
import type { PublicApiUsageLog, PublicInventoryItem } from '@modules/public-api';

export type GovernanceSeverity = 'low' | 'medium' | 'high' | 'critical';
export type GovernanceDecisionType = 'allow' | 'warn' | 'review' | 'deny';
export type GovernancePolicyType = 'exposure' | 'retention' | 'quality' | 'lifecycle';
export type GovernanceLifecycleState =
  | 'draft'
  | 'active'
  | 'under-review'
  | 'suspended'
  | 'archived'
  | 'deleted'
  | 'unknown';

export interface GovernanceRule {
  id: string;
  description: string;
  severity: GovernanceSeverity;
  decision: GovernanceDecisionType;
  enabled: boolean;
}

export interface GovernancePolicy {
  id: string;
  type: GovernancePolicyType;
  name: string;
  version: number;
  enabled: boolean;
  rules: GovernanceRule[];
}

export interface GovernanceDecision {
  decision: GovernanceDecisionType;
  reason: string;
  severity: GovernanceSeverity;
  policyId: string;
  ruleId?: string;
  meta?: Record<string, unknown>;
}

export interface GovernanceExposurePolicy extends GovernancePolicy {
  type: 'exposure';
  minimumQualityScore: number;
  requireMedia: boolean;
  requireCoordinates: boolean;
  requireClearAvailability: boolean;
  denySensitiveFields: string[];
}

export interface GovernanceRetentionPolicy extends GovernancePolicy {
  type: 'retention';
  recommendations: Array<{
    target:
      | 'logs'
      | 'usage-logs'
      | 'media-assets'
      | 'snapshots'
      | 'realtime-events'
      | 'public-api-usage'
      | 'data-quality-snapshots';
    retainForDays: number;
    action: 'review' | 'archive' | 'purge-candidate';
  }>;
}

export interface GovernanceQualityPolicy extends GovernancePolicy {
  type: 'quality';
  minimumGlobalScore: number;
  minimumDomainScore: number;
  criticalIssuesDecision: GovernanceDecisionType;
  degradedDomainDecision: GovernanceDecisionType;
}

export interface GovernanceContext {
  entityType?: 'placa' | 'inventory' | 'media' | 'public-api' | 'snapshot' | 'usage-log' | 'unknown';
  publicItem?: PublicInventoryItem;
  publicItems?: PublicInventoryItem[];
  projectionSnapshot?: ProjectionSnapshot;
  dataQualitySnapshot?: DataQualitySnapshot;
  usageLog?: PublicApiUsageLog;
  sensitiveFields?: string[];
  hasAuditTrail?: boolean;
  now?: Date;
  generatedBy?: string;
}

export interface GovernanceViolation {
  id: string;
  code:
    | 'PUBLIC_ITEM_BELOW_MINIMUM_QUALITY'
    | 'INVALID_MEDIA_EXPOSED'
    | 'INVALID_COORDINATE_IN_CATALOG'
    | 'UNCLEAR_AVAILABILITY'
    | 'SENSITIVE_FIELD_EXPOSED'
    | 'CRITICAL_CONFLICT_EXPOSED'
    | 'SNAPSHOT_WITHOUT_SOURCE'
    | 'USAGE_LOG_WITHOUT_PARTNER'
    | 'LIFECYCLE_INCONSISTENT'
    | 'CRITICAL_DATA_WITHOUT_AUDIT';
  severity: GovernanceSeverity;
  message: string;
  policyId: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

export interface GovernanceEvaluationResult {
  ok: boolean;
  decisions: GovernanceDecision[];
  violations: GovernanceViolation[];
  lifecycleState: GovernanceLifecycleState;
  summary: GovernanceSummary;
}

export interface GovernanceSummary {
  decision: GovernanceDecisionType;
  totalViolations: number;
  bySeverity: Record<GovernanceSeverity, number>;
  requiresReview: boolean;
  highestSeverity: GovernanceSeverity | null;
}

export interface GovernanceSnapshot {
  decisions: GovernanceDecision[];
  violations: GovernanceViolation[];
  lifecycleState: GovernanceLifecycleState;
  summary: GovernanceSummary;
  generatedAt: string;
  sourceProjectionId?: string;
  sourceQualityScore?: number;
}

export interface GovernanceResult {
  ok: boolean;
  snapshot?: GovernanceSnapshot;
  error?: string;
}
