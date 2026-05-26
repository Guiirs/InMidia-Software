import type {
  MarketplaceCapability,
  MarketplacePolicy,
  MarketplacePolicyEvaluationResult,
  MarketplaceTenantAccess,
} from '../contracts/marketplace.contracts';

export const defaultMarketplacePolicy: MarketplacePolicy = {
  id: 'marketplace.default.policy',
  name: 'Marketplace Default Policy',
  description: 'Política base para ativação segura de capabilities internas.',
  minimumGovernanceScore: 70,
  minimumQualityScore: 75,
  allowBeta: true,
  allowInternal: false,
  allowPlanned: false,
  allowDeprecated: true,
  requiredScopes: ['admin.access'],
};

function hasRequiredScopes(accessScopes: string[] | undefined, requiredScopes: string[]): boolean {
  if (requiredScopes.length === 0) return true;
  return requiredScopes.every((scope) => Array.isArray(accessScopes) && accessScopes.includes(scope));
}

function hasEnabledFlag(capability: MarketplaceCapability, access: MarketplaceTenantAccess): boolean {
  if (capability.featureFlags.length === 0) return true;

  return capability.featureFlags.every((flag) => {
    if (!flag.enabled) return false;
    const accessFlag = access.featureFlags?.[flag.key];
    if (accessFlag === false) return false;
    if (flag.tenantIds && flag.tenantIds.length > 0 && access.tenantId && !flag.tenantIds.includes(access.tenantId)) {
      return false;
    }
    if (flag.empresaIds && flag.empresaIds.length > 0 && access.empresaId && !flag.empresaIds.includes(access.empresaId)) {
      return false;
    }
    if (flag.rollout === 'internal' && access.tenantType !== 'internal') {
      return false;
    }
    return true;
  });
}

export class MarketplacePolicyEvaluator {
  constructor(private readonly policy: MarketplacePolicy = defaultMarketplacePolicy) {}

  evaluate(
    capability: MarketplaceCapability,
    access: MarketplaceTenantAccess,
    activeCapabilityIds: Set<string>,
    capabilityLookup: (capabilityId: string) => MarketplaceCapability | undefined,
  ): MarketplacePolicyEvaluationResult {
    const warnings: string[] = [];
    const blockers: string[] = [];
    const missingDependencies: string[] = [];
    const tenantType = access.tenantType ?? 'internal';
    const governanceScore = access.governanceScore ?? 100;
    const qualityScore = access.qualityScore ?? 100;

    if (!access.tenantId) {
      blockers.push('invalid-tenant');
    }

    if (!hasRequiredScopes(access.scopes, [...this.policy.requiredScopes, ...capability.scopes])) {
      blockers.push('missing-scopes');
    }

    if (governanceScore < Math.max(this.policy.minimumGovernanceScore, capability.minimumGovernanceScore)) {
      blockers.push('governance-below-minimum');
    }

    if (qualityScore < Math.max(this.policy.minimumQualityScore, capability.minimumQualityScore)) {
      blockers.push('quality-below-minimum');
    }

    if (!hasEnabledFlag(capability, access)) {
      blockers.push('feature-flag-disabled');
    }

    if (capability.status === 'planned' && !this.policy.allowPlanned) {
      blockers.push('planned');
    }

    if (capability.status === 'disabled') {
      blockers.push('disabled');
    }

    if (capability.status === 'internal' || capability.visibility === 'internal') {
      if (!this.policy.allowInternal || tenantType !== 'internal') {
        blockers.push('internal-hidden');
      }
    }

    if (capability.status === 'beta') {
      if (this.policy.allowBeta) {
        warnings.push('beta');
      } else {
        blockers.push('beta-not-allowed');
      }
    }

    if (capability.status === 'deprecated' && this.policy.allowDeprecated) {
      warnings.push('deprecated');
    }

    for (const dependency of capability.dependencies) {
      if (dependency.required === false) {
        continue;
      }

      const dependencyCapability = capabilityLookup(dependency.capabilityId);
      if (!dependencyCapability) {
        missingDependencies.push(dependency.capabilityId);
        continue;
      }

      const dependencySatisfied = activeCapabilityIds.has(dependency.capabilityId)
        && (!dependency.requiredStatuses || dependency.requiredStatuses.includes(dependencyCapability.status));

      if (!dependencySatisfied) {
        missingDependencies.push(dependency.capabilityId);
      }
    }

    if (missingDependencies.length > 0) {
      blockers.push('dependency-missing');
    }

    return {
      allowed: blockers.length === 0,
      warnings,
      blockers,
      missingDependencies,
    };
  }
}
