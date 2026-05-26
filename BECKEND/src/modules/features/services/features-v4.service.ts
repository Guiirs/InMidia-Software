/**
 * Features V4 Service — Feature flags por tenant
 *
 * Fonte de verdade:
 * 1. Env vars para rollout global/por tenant (pronto para produção).
 * 2. Preparado para persistência futura em DB (apenas adicionar query aqui).
 *
 * Variáveis de ambiente suportadas:
 *   V4_PAINEL_ALL=true          → habilita v4Painel para todos os tenants
 *   V4_ENABLED_TENANTS=id1,id2  → lista de tenantIds com v4Painel habilitado
 *   V4_DEVTOOLS_ALL=true        → habilita syncDevtools (nunca use em produção)
 *
 * Env vars são lidas por requisição (lazy) para suportar override em testes
 * e mudanças de configuração sem restart.
 */

export interface V4FeatureFlags {
  v4Painel:     boolean;
  v4Commercial: boolean;
  v4Reports:    boolean;
  v4Alerts:     boolean;
  v4Operations: boolean;
  syncDevtools: boolean;
}

export class FeaturesV4Service {
  getFlags(tenantId: string): V4FeatureFlags {
    const enabledTenants = new Set(
      (process.env.V4_ENABLED_TENANTS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    );
    const devtoolsTenants = new Set(
      (process.env.V4_DEVTOOLS_TENANTS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    );

    const allEnabled         = process.env.V4_PAINEL_ALL   === 'true';
    const devtoolsAllEnabled = process.env.V4_DEVTOOLS_ALL === 'true';

    const v4Enabled = allEnabled || enabledTenants.has(tenantId);

    return {
      v4Painel:     v4Enabled,
      // Sub-módulos: habilitados apenas se v4Painel estiver habilitado para o tenant.
      // Permite rollout gradual módulo a módulo.
      v4Commercial: v4Enabled && (process.env.V4_COMMERCIAL_ALL === 'true' || enabledTenants.has(tenantId)),
      v4Reports:    v4Enabled && (process.env.V4_REPORTS_ALL    === 'true' || enabledTenants.has(tenantId)),
      v4Alerts:     v4Enabled && (process.env.V4_ALERTS_ALL     === 'true' || enabledTenants.has(tenantId)),
      v4Operations: v4Enabled && (process.env.V4_OPERATIONS_ALL === 'true' || enabledTenants.has(tenantId)),
      // syncDevtools NUNCA habilitado em produção sem flag explícita
      syncDevtools: devtoolsAllEnabled || devtoolsTenants.has(tenantId),
    };
  }
}
