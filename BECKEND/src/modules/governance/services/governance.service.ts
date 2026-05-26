import logger from '@shared/container/logger';
import type {
  GovernanceContext,
  GovernanceDecision,
  GovernanceDecisionType,
  GovernanceEvaluationResult,
  GovernanceLifecycleState,
  GovernanceResult,
  GovernanceSeverity,
  GovernanceSnapshot,
  GovernanceSummary,
  GovernanceViolation,
} from '../contracts/governance.contracts';
import { ExposurePolicyEvaluator } from '../policies/exposure.policy';
import { QualityPolicyEvaluator } from '../policies/quality.policy';
import { RetentionPolicyEvaluator } from '../policies/retention.policy';
import { LifecycleEvaluator } from '../lifecycle/lifecycle.evaluator';
import { GovernanceViolationDetector } from '../evaluators/violation.detector';
import { decisionRank, severityRank, strongestDecision } from '../evaluators/governance.helpers';

const severities: GovernanceSeverity[] = ['low', 'medium', 'high', 'critical'];

export class GovernanceService {
  constructor(
    private readonly exposure = new ExposurePolicyEvaluator(),
    private readonly quality = new QualityPolicyEvaluator(),
    private readonly retention = new RetentionPolicyEvaluator(),
    private readonly lifecycle = new LifecycleEvaluator(),
    private readonly detector = new GovernanceViolationDetector(),
  ) {}

  evaluateGovernance(context: GovernanceContext): GovernanceEvaluationResult {
    const exposure = this.evaluateExposurePolicy(context);
    const quality = this.evaluateQualityPolicy(context);
    const retention = this.evaluateRetentionPolicy(context);
    const lifecycle = this.evaluateLifecycleState(context);
    const detectorViolations = this.detectGovernanceViolations(context);

    const decisions = [
      ...exposure.decisions,
      ...quality.decisions,
      ...retention.decisions,
      ...lifecycle.decisions,
    ];
    const violations = this.dedupeViolations([
      ...exposure.violations,
      ...quality.violations,
      ...retention.violations,
      ...lifecycle.violations,
      ...detectorViolations,
    ]);
    const summary = this.buildGovernanceSummary(decisions, violations);

    if (summary.highestSeverity === 'critical') {
      logger.error('[Governance] Critical violation detected', {
        decision: summary.decision,
        totalViolations: summary.totalViolations,
      });
    } else if (summary.requiresReview) {
      logger.warn('[Governance] Policy review required', {
        decision: summary.decision,
        totalViolations: summary.totalViolations,
      });
    } else {
      logger.info('[Governance] Evaluation completed', {
        decision: summary.decision,
        totalViolations: summary.totalViolations,
      });
    }

    return {
      ok: true,
      decisions,
      violations,
      lifecycleState: lifecycle.state,
      summary,
    };
  }

  evaluateExposurePolicy(context: GovernanceContext) {
    return this.exposure.evaluate(context);
  }

  evaluateRetentionPolicy(context: GovernanceContext) {
    return this.retention.evaluate(context);
  }

  evaluateQualityPolicy(context: GovernanceContext) {
    return this.quality.evaluate(context);
  }

  evaluateLifecycleState(context: GovernanceContext): { decisions: GovernanceDecision[]; violations: GovernanceViolation[]; state: GovernanceLifecycleState } {
    return this.lifecycle.evaluate(context);
  }

  detectGovernanceViolations(context: GovernanceContext): GovernanceViolation[] {
    return this.detector.detect(context);
  }

  buildGovernanceSnapshot(context: GovernanceContext): GovernanceResult {
    try {
      const result = this.evaluateGovernance(context);
      const snapshot: GovernanceSnapshot = {
        decisions: result.decisions,
        violations: result.violations,
        lifecycleState: result.lifecycleState,
        summary: result.summary,
        generatedAt: (context.now ?? new Date()).toISOString(),
        sourceProjectionId: context.projectionSnapshot?.metadata.projectionId,
        sourceQualityScore: context.dataQualitySnapshot?.score.global,
      };
      return { ok: true, snapshot };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[Governance] Snapshot failed', { error: message });
      return { ok: false, error: message };
    }
  }

  buildGovernanceSummary(decisions: GovernanceDecision[], violations: GovernanceViolation[]): GovernanceSummary {
    const bySeverity = severities.reduce<Record<GovernanceSeverity, number>>((acc, severity) => {
      acc[severity] = violations.filter((violation) => violation.severity === severity).length;
      return acc;
    }, { low: 0, medium: 0, high: 0, critical: 0 });

    const decision: GovernanceDecisionType = strongestDecision(decisions.map((item) => item.decision));
    const highestSeverity = violations.reduce<GovernanceSeverity | null>((highest, violation) => {
      if (!highest) return violation.severity;
      return severityRank(violation.severity) > severityRank(highest) ? violation.severity : highest;
    }, null);

    return {
      decision,
      totalViolations: violations.length,
      bySeverity,
      requiresReview: decisionRank(decision) >= decisionRank('review') || bySeverity.high > 0 || bySeverity.critical > 0,
      highestSeverity,
    };
  }

  private dedupeViolations(violations: GovernanceViolation[]): GovernanceViolation[] {
    const seen = new Set<string>();
    return violations.filter((violation) => {
      if (seen.has(violation.id)) return false;
      seen.add(violation.id);
      return true;
    });
  }
}

export const governanceService = new GovernanceService();
