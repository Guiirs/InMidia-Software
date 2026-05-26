import type {
  GovernanceContext,
  GovernanceDecision,
  GovernanceRetentionPolicy,
  GovernanceViolation,
} from '../contracts/governance.contracts';

export const defaultRetentionPolicy: GovernanceRetentionPolicy = {
  id: 'governance.retention.default',
  type: 'retention',
  name: 'Default retention recommendation policy',
  version: 1,
  enabled: true,
  rules: [
    { id: 'recommend-only', description: 'Retention is recommendation-only in v1.', severity: 'low', decision: 'warn', enabled: true },
  ],
  recommendations: [
    { target: 'logs', retainForDays: 90, action: 'archive' },
    { target: 'usage-logs', retainForDays: 365, action: 'review' },
    { target: 'media-assets', retainForDays: 1095, action: 'review' },
    { target: 'snapshots', retainForDays: 180, action: 'archive' },
    { target: 'realtime-events', retainForDays: 30, action: 'archive' },
    { target: 'public-api-usage', retainForDays: 365, action: 'review' },
    { target: 'data-quality-snapshots', retainForDays: 180, action: 'archive' },
  ],
};

export class RetentionPolicyEvaluator {
  constructor(private readonly policy: GovernanceRetentionPolicy = defaultRetentionPolicy) {}

  evaluate(_context: GovernanceContext): { decisions: GovernanceDecision[]; violations: GovernanceViolation[] } {
    return {
      decisions: [{
        decision: 'warn',
        reason: 'Retention policy gerou recomendacoes sem apagar dados.',
        severity: 'low',
        policyId: this.policy.id,
        ruleId: 'recommend-only',
        meta: { recommendations: this.policy.recommendations },
      }],
      violations: [],
    };
  }
}
