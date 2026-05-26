import { marketplaceService } from '../services/marketplace.service';
import { MARKETPLACE_CAPABILITY_REGISTRY, MARKETPLACE_MODULE_REGISTRY } from '../registry/marketplace.registry';

function makeInternalAccess(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-001',
    empresaId: 'empresa-001',
    actorId: 'user-001',
    role: 'admin_empresa',
    tenantType: 'internal' as const,
    governanceScore: 95,
    qualityScore: 95,
    scopes: ['admin.access'],
    featureFlags: {},
    ...overrides,
  };
}

function makeExternalAccess(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-002',
    empresaId: 'empresa-002',
    actorId: 'user-002',
    role: 'viewer',
    tenantType: 'external' as const,
    governanceScore: 95,
    qualityScore: 95,
    scopes: ['admin.access'],
    featureFlags: {},
    ...overrides,
  };
}

describe('Marketplace registry', () => {
  it('registers modules and capabilities', () => {
    expect(MARKETPLACE_MODULE_REGISTRY.length).toBeGreaterThan(0);
    expect(MARKETPLACE_CAPABILITY_REGISTRY.length).toBeGreaterThan(0);
  });
});

describe('MarketplaceService', () => {
  it('lists modules for an internal tenant', () => {
    const modules = marketplaceService.listModules(makeInternalAccess());
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.some((module) => module.id === 'analytics-suite')).toBe(true);
  });

  it('lists capabilities for an internal tenant', () => {
    const capabilities = marketplaceService.listCapabilities(makeInternalAccess());
    expect(capabilities.some((capability) => capability.id === 'enterprise-bi')).toBe(true);
  });

  it('activates a beta capability', () => {
    const result = marketplaceService.activateCapability({ capabilityId: 'realtime-streams', ...makeInternalAccess() });
    expect(result.success).toBe(true);
    expect(result.status).toBe('activated');
    expect(result.warnings).toContain('beta');
  });

  it('deactivates a capability', () => {
    marketplaceService.activateCapability({ capabilityId: 'exports', ...makeInternalAccess() });
    const result = marketplaceService.deactivateCapability({ capabilityId: 'exports', ...makeInternalAccess() });
    expect(result.success).toBe(true);
    expect(result.status).toBe('deactivated');
  });

  it('blocks planned capability activation', () => {
    const result = marketplaceService.activateCapability({ capabilityId: 'marketplace-automation', ...makeInternalAccess() });
    expect(result.success).toBe(false);
    expect(result.blockers).toContain('planned');
  });

  it('allows beta capability activation', () => {
    const result = marketplaceService.activateCapability({ capabilityId: 'realtime-streams', ...makeInternalAccess() });
    expect(result.success).toBe(true);
  });

  it('hides internal capability from external tenants', () => {
    const capabilities = marketplaceService.listCapabilities(makeExternalAccess());
    expect(capabilities.some((capability) => capability.id === 'partner-access')).toBe(false);
  });

  it('evaluates governance validation', () => {
    const result = marketplaceService.activateCapability({ capabilityId: 'governance-reports', ...makeInternalAccess({ governanceScore: 50 }) });
    expect(result.success).toBe(false);
    expect(result.blockers).toContain('governance-below-minimum');
  });

  it('evaluates quality validation', () => {
    const result = marketplaceService.activateCapability({ capabilityId: 'quality-monitoring', ...makeInternalAccess({ qualityScore: 40 }) });
    expect(result.success).toBe(false);
    expect(result.blockers).toContain('quality-below-minimum');
  });

  it('returns dependency validation failure', () => {
    const result = marketplaceService.activateCapability({ capabilityId: 'exports', ...makeInternalAccess() });
    expect(result.success).toBe(false);
    expect(result.blockers).toContain('dependency-missing');
    expect(result.missingDependencies).toContain('enterprise-bi');
  });

  it('resolves active tenant capabilities after activation', () => {
    const access = makeInternalAccess({ tenantId: 'tenant-xyz', empresaId: 'empresa-xyz' });
    marketplaceService.activateCapability({ capabilityId: 'enterprise-bi', ...access });
    marketplaceService.activateCapability({ capabilityId: 'exports', ...access });
    const active = marketplaceService.resolveTenantCapabilities(access);
    expect(active).toContain('enterprise-bi');
  });
});
