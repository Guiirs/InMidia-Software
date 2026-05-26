import type {
  GovernanceDecisionType,
  GovernanceSeverity,
  GovernanceViolation,
} from '../contracts/governance.contracts';

export function severityRank(severity: GovernanceSeverity): number {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

export function decisionRank(decision: GovernanceDecisionType): number {
  if (decision === 'deny') return 4;
  if (decision === 'review') return 3;
  if (decision === 'warn') return 2;
  return 1;
}

export function strongestDecision(decisions: GovernanceDecisionType[]): GovernanceDecisionType {
  return decisions.reduce<GovernanceDecisionType>((strongest, decision) => (
    decisionRank(decision) > decisionRank(strongest) ? decision : strongest
  ), 'allow');
}

export function createViolation(
  code: GovernanceViolation['code'],
  severity: GovernanceSeverity,
  message: string,
  policyId: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): GovernanceViolation {
  return {
    id: `${policyId}:${code}:${entityId ?? 'global'}:${JSON.stringify(meta ?? {})}`,
    code,
    severity,
    message,
    policyId,
    entityId,
    meta,
  };
}
