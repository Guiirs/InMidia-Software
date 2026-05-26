import type {
  GovernanceContext,
  GovernanceDecision,
  GovernanceExposurePolicy,
  GovernanceViolation,
} from '../contracts/governance.contracts';
import { createViolation } from '../evaluators/governance.helpers';

export const defaultExposurePolicy: GovernanceExposurePolicy = {
  id: 'governance.exposure.default',
  type: 'exposure',
  name: 'Default public exposure policy',
  version: 1,
  enabled: true,
  minimumQualityScore: 70,
  requireMedia: true,
  requireCoordinates: true,
  requireClearAvailability: true,
  denySensitiveFields: ['_id', 'empresaId', 'user', 'audit', 'financeiro', 'internalLogs'],
  rules: [
    { id: 'media-minimum', description: 'Public item should have valid media.', severity: 'medium', decision: 'warn', enabled: true },
    { id: 'geo-minimum', description: 'Public item should have valid coordinates.', severity: 'high', decision: 'review', enabled: true },
    { id: 'availability-clear', description: 'Public item should have clear availability.', severity: 'medium', decision: 'warn', enabled: true },
    { id: 'sensitive-fields', description: 'Public exposure must not include sensitive fields.', severity: 'critical', decision: 'deny', enabled: true },
  ],
};

export class ExposurePolicyEvaluator {
  constructor(private readonly policy: GovernanceExposurePolicy = defaultExposurePolicy) {}

  evaluate(context: GovernanceContext): { decisions: GovernanceDecision[]; violations: GovernanceViolation[] } {
    const decisions: GovernanceDecision[] = [];
    const violations: GovernanceViolation[] = [];
    const items = context.publicItems ?? (context.publicItem ? [context.publicItem] : []);

    items.forEach((item) => {
      if (this.policy.requireMedia && (!item.media || item.media.status === 'invalid' || item.media.status === 'failed')) {
        violations.push(createViolation('INVALID_MEDIA_EXPOSED', 'medium', 'Item publico sem midia valida para exposicao.', this.policy.id, item.id, { mediaStatus: item.media?.status }));
        decisions.push({ decision: 'warn', reason: 'Midia publica ausente ou invalida.', severity: 'medium', policyId: this.policy.id, ruleId: 'media-minimum' });
      }

      if (this.policy.requireCoordinates && !item.location?.geo) {
        violations.push(createViolation('INVALID_COORDINATE_IN_CATALOG', 'high', 'Item publico sem coordenada valida.', this.policy.id, item.id));
        decisions.push({ decision: 'review', reason: 'Coordenada ausente para catalogo publico.', severity: 'high', policyId: this.policy.id, ruleId: 'geo-minimum' });
      }

      if (this.policy.requireClearAvailability && item.availability.status === 'unknown') {
        violations.push(createViolation('UNCLEAR_AVAILABILITY', 'medium', 'Item publico sem disponibilidade clara.', this.policy.id, item.id));
        decisions.push({ decision: 'warn', reason: 'Disponibilidade publica desconhecida.', severity: 'medium', policyId: this.policy.id, ruleId: 'availability-clear' });
      }

      if (item.status.operational === 'conflict') {
        violations.push(createViolation('CRITICAL_CONFLICT_EXPOSED', 'high', 'Item publico possui conflito operacional.', this.policy.id, item.id));
        decisions.push({ decision: 'review', reason: 'Conflito operacional exige revisao antes de exposicao.', severity: 'high', policyId: this.policy.id });
      }
    });

    const exposedSensitive = (context.sensitiveFields ?? []).filter((field) => this.policy.denySensitiveFields.includes(field));
    if (exposedSensitive.length > 0) {
      violations.push(createViolation('SENSITIVE_FIELD_EXPOSED', 'critical', 'Campo sensivel seria exposto na API publica.', this.policy.id, undefined, { fields: exposedSensitive }));
      decisions.push({ decision: 'deny', reason: 'Campo sensivel detectado.', severity: 'critical', policyId: this.policy.id, ruleId: 'sensitive-fields', meta: { fields: exposedSensitive } });
    }

    if (decisions.length === 0) {
      decisions.push({ decision: 'allow', reason: 'Item elegivel para exposicao publica controlada.', severity: 'low', policyId: this.policy.id });
    }

    return { decisions, violations };
  }
}
