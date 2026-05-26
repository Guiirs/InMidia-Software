import type {
  GovernanceContext,
  GovernanceDecision,
  GovernanceQualityPolicy,
  GovernanceViolation,
} from '../contracts/governance.contracts';
import { createViolation } from '../evaluators/governance.helpers';

export const defaultQualityPolicy: GovernanceQualityPolicy = {
  id: 'governance.quality.default',
  type: 'quality',
  name: 'Default data quality policy',
  version: 1,
  enabled: true,
  minimumGlobalScore: 75,
  minimumDomainScore: 70,
  criticalIssuesDecision: 'review',
  degradedDomainDecision: 'warn',
  rules: [
    { id: 'global-score', description: 'Global data quality should meet minimum score.', severity: 'high', decision: 'review', enabled: true },
    { id: 'critical-issues', description: 'Critical quality issues require review.', severity: 'critical', decision: 'review', enabled: true },
    { id: 'domain-score', description: 'Domain score degradation should warn.', severity: 'medium', decision: 'warn', enabled: true },
  ],
};

export class QualityPolicyEvaluator {
  constructor(private readonly policy: GovernanceQualityPolicy = defaultQualityPolicy) {}

  evaluate(context: GovernanceContext): { decisions: GovernanceDecision[]; violations: GovernanceViolation[] } {
    const quality = context.dataQualitySnapshot;
    const decisions: GovernanceDecision[] = [];
    const violations: GovernanceViolation[] = [];

    if (!quality) {
      decisions.push({ decision: 'review', reason: 'Sem snapshot de qualidade para decisao de governanca.', severity: 'medium', policyId: this.policy.id });
      return { decisions, violations };
    }

    if (quality.score.global < this.policy.minimumGlobalScore) {
      violations.push(createViolation('PUBLIC_ITEM_BELOW_MINIMUM_QUALITY', 'high', 'Score global abaixo do minimo recomendado.', this.policy.id, quality.sourceProjectionId, { score: quality.score.global }));
      decisions.push({ decision: 'review', reason: 'Score global de qualidade exige revisao.', severity: 'high', policyId: this.policy.id, ruleId: 'global-score', meta: { score: quality.score.global } });
    }

    if (quality.summary.bySeverity.critical > 0) {
      violations.push(createViolation('CRITICAL_DATA_WITHOUT_AUDIT', 'critical', 'Issues criticas de qualidade exigem trilha de auditoria.', this.policy.id, quality.sourceProjectionId));
      decisions.push({ decision: this.policy.criticalIssuesDecision, reason: 'Issue critica de qualidade detectada.', severity: 'critical', policyId: this.policy.id, ruleId: 'critical-issues' });
    }

    const degradedDomains = Object.entries(quality.score)
      .filter(([domain, score]) => domain !== 'global' && score < this.policy.minimumDomainScore)
      .map(([domain]) => domain);

    if (degradedDomains.length > 0) {
      decisions.push({ decision: this.policy.degradedDomainDecision, reason: 'Dominio de qualidade degradado.', severity: 'medium', policyId: this.policy.id, ruleId: 'domain-score', meta: { degradedDomains } });
    }

    if (decisions.length === 0) {
      decisions.push({ decision: 'allow', reason: 'Qualidade atende politica minima.', severity: 'low', policyId: this.policy.id });
    }

    return { decisions, violations };
  }
}
