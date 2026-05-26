export type MarketplaceStatus = 'available' | 'disabled' | 'beta' | 'internal' | 'deprecated' | 'planned';

export type MarketplaceCategory =
  | 'analytics'
  | 'geo'
  | 'media'
  | 'governance'
  | 'export'
  | 'realtime'
  | 'integrations'
  | 'inventory'
  | 'public-api';

export type MarketplaceVisibility = 'public' | 'tenant' | 'restricted' | 'internal';

export interface MarketplaceFeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  rollout?: 'all' | 'beta' | 'internal';
  tenantIds?: string[];
  empresaIds?: string[];
}

export interface MarketplaceDependency {
  capabilityId: string;
  requiredStatuses?: MarketplaceStatus[];
  required?: boolean;
}

export interface MarketplaceModule {
  id: string;
  name: string;
  description: string;
  category: MarketplaceCategory;
  status: MarketplaceStatus;
  visibility: MarketplaceVisibility;
  capabilities: string[];
  dependencies: MarketplaceDependency[];
  requirements: string[];
  scopes: string[];
  minimumGovernanceScore: number;
  minimumQualityScore: number;
  featureFlags: MarketplaceFeatureFlag[];
}

export interface MarketplaceCapability {
  id: string;
  name: string;
  description: string;
  category: MarketplaceCategory;
  status: MarketplaceStatus;
  visibility: MarketplaceVisibility;
  dependencies: MarketplaceDependency[];
  requirements: string[];
  scopes: string[];
  minimumGovernanceScore: number;
  minimumQualityScore: number;
  featureFlags: MarketplaceFeatureFlag[];
  modules: string[];
}

export interface MarketplaceTenantAccess {
  tenantId: string;
  empresaId?: string;
  actorId?: string;
  role?: string;
  tenantType?: 'internal' | 'external';
  governanceScore?: number;
  qualityScore?: number;
  scopes?: string[];
  featureFlags?: Record<string, boolean>;
}

export interface MarketplacePolicy {
  id: string;
  name: string;
  description: string;
  minimumGovernanceScore: number;
  minimumQualityScore: number;
  allowBeta: boolean;
  allowInternal: boolean;
  allowPlanned: boolean;
  allowDeprecated: boolean;
  requiredScopes: string[];
}

export interface MarketplacePolicyEvaluationResult {
  allowed: boolean;
  warnings: string[];
  blockers: string[];
  missingDependencies: string[];
}

export interface MarketplaceCapabilityState extends MarketplaceCapability {
  active: boolean;
  visible: boolean;
  canActivate: boolean;
  warnings: string[];
  blockers: string[];
  missingDependencies: string[];
}

export interface MarketplaceModuleState extends MarketplaceModule {
  visible: boolean;
  activeCapabilities: number;
  availableCapabilities: number;
}

export interface MarketplaceCatalog {
  modules: MarketplaceModuleState[];
  capabilities: MarketplaceCapabilityState[];
  summary: {
    generatedAt: string;
    tenantId: string;
    empresaId?: string;
    tenantType: 'internal' | 'external';
    totalModules: number;
    totalCapabilities: number;
    visibleModules: number;
    visibleCapabilities: number;
    activeCapabilities: number;
  };
}

export interface MarketplaceActivationRequest {
  capabilityId: string;
  tenantId?: string;
  empresaId?: string;
  actorId?: string;
  role?: string;
  tenantType?: 'internal' | 'external';
  governanceScore?: number;
  qualityScore?: number;
  scopes?: string[];
  featureFlags?: Record<string, boolean>;
}

export interface MarketplaceActivationResult {
  success: boolean;
  capabilityId: string;
  status: 'activated' | 'deactivated' | 'blocked' | 'not-found';
  message: string;
  tenantId: string;
  empresaId?: string;
  actorId?: string;
  warnings: string[];
  blockers: string[];
  missingDependencies: string[];
  activeCapabilities: string[];
  policy: MarketplacePolicyEvaluationResult;
  timestamp: string;
}

export interface MarketplaceActivityLogEntry {
  action: 'activate' | 'deactivate' | 'deny' | 'dependency-missing' | 'invalid-tenant';
  capabilityId?: string;
  tenantId?: string;
  empresaId?: string;
  actorId?: string;
  role?: string;
  outcome: 'success' | 'warn' | 'blocked' | 'error';
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface MarketplaceListResponse {
  success: boolean;
  modules: MarketplaceModuleState[];
  capabilities: MarketplaceCapabilityState[];
  summary: MarketplaceCatalog['summary'];
}
