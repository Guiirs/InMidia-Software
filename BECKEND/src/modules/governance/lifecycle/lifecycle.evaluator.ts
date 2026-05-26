import type {
  GovernanceContext,
  GovernanceDecision,
  GovernanceLifecycleState,
  GovernanceViolation,
} from '../contracts/governance.contracts';
import { createViolation } from '../evaluators/governance.helpers';

export class LifecycleEvaluator {
  evaluateState(context: GovernanceContext): GovernanceLifecycleState {
    const item = context.publicItem;
    if (!item && !context.projectionSnapshot) return 'unknown';
    if (item?.status.physical === 'removed') return 'archived';
    if (item?.status.physical === 'inactive') return 'suspended';
    if (item && (!item.boardNumber || !item.operationalNumber || !item.region?.id)) return 'draft';
    if (item?.status.operational === 'conflict' || item?.status.operational === 'incomplete') return 'under-review';
    if (item || context.projectionSnapshot) return 'active';
    return 'unknown';
  }

  evaluate(context: GovernanceContext): { decisions: GovernanceDecision[]; violations: GovernanceViolation[]; state: GovernanceLifecycleState } {
    const state = this.evaluateState(context);
    const decisions: GovernanceDecision[] = [];
    const violations: GovernanceViolation[] = [];

    if (state === 'unknown') {
      decisions.push({ decision: 'review', reason: 'Lifecycle nao pode ser inferido.', severity: 'medium', policyId: 'governance.lifecycle.default' });
    } else if (state === 'draft' || state === 'under-review') {
      violations.push(createViolation('LIFECYCLE_INCONSISTENT', 'medium', 'Lifecycle exige revisao operacional.', 'governance.lifecycle.default', context.publicItem?.id, { state }));
      decisions.push({ decision: 'review', reason: 'Lifecycle ainda nao esta pronto para governanca plena.', severity: 'medium', policyId: 'governance.lifecycle.default', meta: { state } });
    } else if (state === 'archived' || state === 'suspended') {
      decisions.push({ decision: 'warn', reason: 'Lifecycle indica entidade fora do estado ativo.', severity: 'medium', policyId: 'governance.lifecycle.default', meta: { state } });
    } else {
      decisions.push({ decision: 'allow', reason: 'Lifecycle ativo.', severity: 'low', policyId: 'governance.lifecycle.default', meta: { state } });
    }

    return { decisions, violations, state };
  }
}
