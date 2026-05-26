import logger from '@shared/container/logger';
import {
  type MarketplaceActivationRequest,
  type MarketplaceActivationResult,
  type MarketplaceActivityLogEntry,
  type MarketplaceCatalog,
  type MarketplaceCapability,
  type MarketplaceCapabilityState,
  type MarketplaceListResponse,
  type MarketplaceModule,
  type MarketplaceModuleState,
  type MarketplaceTenantAccess,
} from '../contracts/marketplace.contracts';
import { MARKETPLACE_CAPABILITY_REGISTRY, MARKETPLACE_MODULE_REGISTRY, getMarketplaceCapability } from '../registry/marketplace.registry';
import { MarketplacePolicyEvaluator } from '../policies/marketplace.policy';

function resolveTenantKey(access: Partial<MarketplaceTenantAccess>): string {
  return access.tenantId || access.empresaId || '';
}

function resolveTenantType(access: Partial<MarketplaceTenantAccess>): 'internal' | 'external' {
  return access.tenantType ?? 'internal';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export class MarketplaceService {
  private readonly policyEvaluator = new MarketplacePolicyEvaluator();
  private readonly activations = new Map<string, Set<string>>();
  private readonly activityLog: MarketplaceActivityLogEntry[] = [];

  listModules(access: MarketplaceTenantAccess): MarketplaceModuleState[] {
    return this.buildMarketplaceCatalog(access).modules;
  }

  listCapabilities(access: MarketplaceTenantAccess): MarketplaceCapabilityState[] {
    return this.buildMarketplaceCatalog(access).capabilities;
  }

  resolveTenantCapabilities(access: Partial<MarketplaceTenantAccess>): string[] {
    return Array.from(this.getActiveCapabilityIds(access));
  }

  evaluateMarketplacePolicy(capabilityId: string, access: MarketplaceTenantAccess) {
    const capability = getMarketplaceCapability(capabilityId);
    if (!capability) {
      return {
        allowed: false,
        warnings: [],
        blockers: ['not-found'],
        missingDependencies: [],
      };
    }

    return this.policyEvaluator.evaluate(capability, access, this.getActiveCapabilityIds(access), getMarketplaceCapability);
  }

  activateCapability(request: MarketplaceActivationRequest): MarketplaceActivationResult {
    const tenantId = resolveTenantKey(request);
    const timestamp = new Date().toISOString();
    const capability = getMarketplaceCapability(request.capabilityId);

    if (!tenantId) {
      const result: MarketplaceActivationResult = {
        success: false,
        capabilityId: request.capabilityId,
        status: 'blocked',
        message: 'tenantId obrigatório para ativação de capability.',
        tenantId: '',
        empresaId: request.empresaId,
        actorId: request.actorId,
        warnings: [],
        blockers: ['invalid-tenant'],
        missingDependencies: [],
        activeCapabilities: [],
        policy: { allowed: false, warnings: [], blockers: ['invalid-tenant'], missingDependencies: [] },
        timestamp,
      };
      this.recordActivity({
        action: 'invalid-tenant',
        capabilityId: request.capabilityId,
        tenantId,
        empresaId: request.empresaId,
        actorId: request.actorId,
        role: request.role,
        outcome: 'error',
        message: result.message,
        timestamp,
      });
      logger.warn('[Marketplace] Invalid tenant activation attempt', { capabilityId: request.capabilityId });
      return result;
    }

    if (!capability) {
      const result: MarketplaceActivationResult = {
        success: false,
        capabilityId: request.capabilityId,
        status: 'not-found',
        message: 'Capability não encontrada.',
        tenantId,
        empresaId: request.empresaId,
        actorId: request.actorId,
        warnings: [],
        blockers: ['not-found'],
        missingDependencies: [],
        activeCapabilities: this.resolveTenantCapabilities({ ...request, tenantId }),
        policy: { allowed: false, warnings: [], blockers: ['not-found'], missingDependencies: [] },
        timestamp,
      };
      this.recordActivity({
        action: 'deny',
        capabilityId: request.capabilityId,
        tenantId,
        empresaId: request.empresaId,
        actorId: request.actorId,
        role: request.role,
        outcome: 'blocked',
        message: result.message,
        timestamp,
      });
      logger.warn('[Marketplace] Capability not found', { capabilityId: request.capabilityId, tenantId });
      return result;
    }

    const access = this.normalizeAccess(request, tenantId, capability);
    const policy = this.policyEvaluator.evaluate(capability, access, this.getActiveCapabilityIds(access), getMarketplaceCapability);
    const activeCapabilities = this.resolveTenantCapabilities(access);

    if (!policy.allowed) {
      const result: MarketplaceActivationResult = {
        success: false,
        capabilityId: capability.id,
        status: 'blocked',
        message: this.buildBlockedMessage(capability, policy),
        tenantId,
        empresaId: access.empresaId,
        actorId: access.actorId,
        warnings: policy.warnings,
        blockers: policy.blockers,
        missingDependencies: policy.missingDependencies,
        activeCapabilities,
        policy,
        timestamp,
      };

      this.recordBlockedActivation(access, capability, policy, timestamp);
      logger.warn('[Marketplace] Activation blocked', {
        capabilityId: capability.id,
        tenantId,
        blockers: policy.blockers,
      });
      return result;
    }

    const tenantActivations = this.getOrCreateTenantActivationSet(access);
    const alreadyActive = tenantActivations.has(capability.id);
    tenantActivations.add(capability.id);

    const result: MarketplaceActivationResult = {
      success: true,
      capabilityId: capability.id,
      status: 'activated',
      message: alreadyActive ? 'Capability já estava ativa.' : 'Capability ativada com sucesso.',
      tenantId,
      empresaId: access.empresaId,
      actorId: access.actorId,
      warnings: policy.warnings,
      blockers: [],
      missingDependencies: [],
      activeCapabilities: this.resolveTenantCapabilities(access),
      policy,
      timestamp,
    };

    this.recordActivity({
      action: 'activate',
      capabilityId: capability.id,
      tenantId,
      empresaId: access.empresaId,
      actorId: access.actorId,
      role: access.role,
      outcome: 'success',
      message: result.message,
      timestamp,
      meta: { alreadyActive, warnings: policy.warnings },
    });

    logger.info('[Marketplace] Capability activated', {
      capabilityId: capability.id,
      tenantId,
      actorId: access.actorId,
      alreadyActive,
    });

    return result;
  }

  deactivateCapability(request: MarketplaceActivationRequest): MarketplaceActivationResult {
    const tenantId = resolveTenantKey(request);
    const timestamp = new Date().toISOString();
    const capability = getMarketplaceCapability(request.capabilityId);

    if (!tenantId) {
      const result: MarketplaceActivationResult = {
        success: false,
        capabilityId: request.capabilityId,
        status: 'blocked',
        message: 'tenantId obrigatório para desativação de capability.',
        tenantId: '',
        empresaId: request.empresaId,
        actorId: request.actorId,
        warnings: [],
        blockers: ['invalid-tenant'],
        missingDependencies: [],
        activeCapabilities: [],
        policy: { allowed: false, warnings: [], blockers: ['invalid-tenant'], missingDependencies: [] },
        timestamp,
      };
      this.recordActivity({
        action: 'invalid-tenant',
        capabilityId: request.capabilityId,
        tenantId,
        empresaId: request.empresaId,
        actorId: request.actorId,
        role: request.role,
        outcome: 'error',
        message: result.message,
        timestamp,
      });
      return result;
    }

    if (!capability) {
      const result: MarketplaceActivationResult = {
        success: false,
        capabilityId: request.capabilityId,
        status: 'not-found',
        message: 'Capability não encontrada.',
        tenantId,
        empresaId: request.empresaId,
        actorId: request.actorId,
        warnings: [],
        blockers: ['not-found'],
        missingDependencies: [],
        activeCapabilities: this.resolveTenantCapabilities({ ...request, tenantId }),
        policy: { allowed: false, warnings: [], blockers: ['not-found'], missingDependencies: [] },
        timestamp,
      };
      return result;
    }

    const access = this.normalizeAccess(request, tenantId, capability);
    const tenantActivations = this.getOrCreateTenantActivationSet(access);
    const wasActive = tenantActivations.delete(capability.id);

    const result: MarketplaceActivationResult = {
      success: true,
      capabilityId: capability.id,
      status: 'deactivated',
      message: wasActive ? 'Capability desativada com sucesso.' : 'Capability já estava desativada.',
      tenantId,
      empresaId: access.empresaId,
      actorId: access.actorId,
      warnings: [],
      blockers: [],
      missingDependencies: [],
      activeCapabilities: this.resolveTenantCapabilities(access),
      policy: { allowed: true, warnings: [], blockers: [], missingDependencies: [] },
      timestamp,
    };

    this.recordActivity({
      action: 'deactivate',
      capabilityId: capability.id,
      tenantId,
      empresaId: access.empresaId,
      actorId: access.actorId,
      role: access.role,
      outcome: 'success',
      message: result.message,
      timestamp,
      meta: { wasActive },
    });

    logger.info('[Marketplace] Capability deactivated', {
      capabilityId: capability.id,
      tenantId,
      actorId: access.actorId,
      wasActive,
    });

    return result;
  }

  buildMarketplaceCatalog(access: MarketplaceTenantAccess): MarketplaceCatalog {
    const normalizedAccess = this.normalizeAccess(access, resolveTenantKey(access));
    const activeCapabilityIds = this.getActiveCapabilityIds(normalizedAccess);
    const visibleCapabilities = MARKETPLACE_CAPABILITY_REGISTRY.filter((capability) => this.isVisibleToTenant(capability, normalizedAccess));
    const visibleCapabilityIds = new Set(visibleCapabilities.map((capability) => capability.id));

    const capabilities = visibleCapabilities.map((capability) => this.toCapabilityState(capability, normalizedAccess, activeCapabilityIds));
    const modules = MARKETPLACE_MODULE_REGISTRY
      .filter((module) => this.isVisibleToTenant(module, normalizedAccess))
      .map((module) => this.toModuleState(module, capabilities, visibleCapabilityIds));

    return {
      modules,
      capabilities,
      summary: {
        generatedAt: new Date().toISOString(),
        tenantId: normalizedAccess.tenantId,
        empresaId: normalizedAccess.empresaId,
        tenantType: resolveTenantType(normalizedAccess),
        totalModules: MARKETPLACE_MODULE_REGISTRY.length,
        totalCapabilities: MARKETPLACE_CAPABILITY_REGISTRY.length,
        visibleModules: modules.length,
        visibleCapabilities: capabilities.length,
        activeCapabilities: capabilities.filter((capability) => capability.active).length,
      },
    };
  }

  getActivityLog(): MarketplaceActivityLogEntry[] {
    return [...this.activityLog];
  }

  private normalizeAccess(access: Partial<MarketplaceTenantAccess>, tenantIdFallback?: string, capability?: MarketplaceCapability): MarketplaceTenantAccess {
    return {
      ...access,
      tenantId: access.tenantId || tenantIdFallback || '',
      empresaId: access.empresaId || access.tenantId || tenantIdFallback,
      tenantType: access.tenantType ?? 'internal',
      governanceScore: access.governanceScore ?? capability?.minimumGovernanceScore ?? 100,
      qualityScore: access.qualityScore ?? capability?.minimumQualityScore ?? 100,
      scopes: uniqueSorted([...(access.scopes ?? []), 'admin.access']),
      featureFlags: access.featureFlags ?? {},
    };
  }

  private getTenantKey(access: Partial<MarketplaceTenantAccess>): string {
    return resolveTenantKey(access);
  }

  private getOrCreateTenantActivationSet(access: Partial<MarketplaceTenantAccess>): Set<string> {
    const tenantKey = this.getTenantKey(access);
    if (!this.activations.has(tenantKey)) {
      this.activations.set(tenantKey, new Set<string>());
    }
    return this.activations.get(tenantKey)!;
  }

  private getActiveCapabilityIds(access: Partial<MarketplaceTenantAccess>): Set<string> {
    const tenantKey = this.getTenantKey(access);
    return new Set(this.activations.get(tenantKey) ?? []);
  }

  private isVisibleToTenant(entity: { visibility: string }, access: MarketplaceTenantAccess): boolean {
    if (entity.visibility === 'internal') return resolveTenantType(access) === 'internal';
    return true;
  }

  private toCapabilityState(
    capability: MarketplaceCapability,
    access: MarketplaceTenantAccess,
    activeCapabilityIds: Set<string>,
  ): MarketplaceCapabilityState {
    const policy = this.policyEvaluator.evaluate(capability, access, activeCapabilityIds, getMarketplaceCapability);
    return {
      ...capability,
      active: activeCapabilityIds.has(capability.id),
      visible: this.isVisibleToTenant(capability, access),
      canActivate: policy.allowed && !activeCapabilityIds.has(capability.id),
      warnings: policy.warnings,
      blockers: policy.blockers,
      missingDependencies: policy.missingDependencies,
    };
  }

  private toModuleState(
    module: MarketplaceModule,
    capabilities: MarketplaceCapabilityState[],
    visibleCapabilityIds: Set<string>,
  ): MarketplaceModuleState {
    const moduleCapabilities = module.capabilities.filter((capabilityId) => visibleCapabilityIds.has(capabilityId));
    const activeCapabilities = moduleCapabilities.filter((capabilityId) => capabilities.some((capability) => capability.id === capabilityId && capability.active)).length;
    const availableCapabilities = moduleCapabilities.length;

    return {
      ...module,
      visible: true,
      activeCapabilities,
      availableCapabilities,
    };
  }

  private buildBlockedMessage(capability: MarketplaceCapability, policy: { blockers: string[] }): string {
    if (policy.blockers.includes('planned')) return `Capability "${capability.name}" está planejada e ainda não pode ser ativada.`;
    if (policy.blockers.includes('internal-hidden')) return `Capability "${capability.name}" é interna e não está disponível para este tenant.`;
    if (policy.blockers.includes('dependency-missing')) return `Dependências ausentes para "${capability.name}".`;
    if (policy.blockers.includes('governance-below-minimum')) return `Governança insuficiente para ativar "${capability.name}".`;
    if (policy.blockers.includes('quality-below-minimum')) return `Qualidade insuficiente para ativar "${capability.name}".`;
    if (policy.blockers.includes('feature-flag-disabled')) return `Feature flag desativada para "${capability.name}".`;
    if (policy.blockers.includes('missing-scopes')) return `Escopos insuficientes para ativar "${capability.name}".`;
    return `Capability "${capability.name}" não pode ser ativada no estado atual.`;
  }

  private recordActivity(entry: MarketplaceActivityLogEntry): void {
    this.activityLog.push(entry);
    if (this.activityLog.length > 200) {
      this.activityLog.splice(0, this.activityLog.length - 200);
    }
  }

  private recordBlockedActivation(
    access: MarketplaceTenantAccess,
    capability: MarketplaceCapability,
    policy: { blockers: string[]; missingDependencies: string[]; warnings: string[] },
    timestamp: string,
  ): void {
    this.recordActivity({
      action: policy.blockers.includes('dependency-missing') ? 'dependency-missing' : 'deny',
      capabilityId: capability.id,
      tenantId: access.tenantId,
      empresaId: access.empresaId,
      actorId: access.actorId,
      role: access.role,
      outcome: 'blocked',
      message: this.buildBlockedMessage(capability, policy),
      timestamp,
      meta: {
        blockers: policy.blockers,
        missingDependencies: policy.missingDependencies,
        warnings: policy.warnings,
      },
    });
  }
}

export const marketplaceService = new MarketplaceService();

export function createMarketplaceListResponse(access: MarketplaceTenantAccess): MarketplaceListResponse {
  return {
    success: true,
    ...marketplaceService.buildMarketplaceCatalog(access),
  };
}
