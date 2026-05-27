/**
 * Registro Central de Módulos
 * 
 * Define todos os módulos disponíveis na aplicação e suas configurações
 */

import { Router } from 'express';

import authRoutes from '@modules/auth/auth.routes';
import userRoutes from '@modules/users/user.routes';
import empresaRoutes from '@modules/empresas/empresa.routes';
import empresaPublicRoutes from '@modules/empresas/empresa-public.routes';
import clienteRoutes from '@modules/clientes/cliente.routes';
import placaRoutes from '@modules/placas/placas.routes';
import regiaoRoutes from '@modules/regioes/regiao.routes';
import aluguelRoutes from '@modules/alugueis/aluguel.routes';
import piRoutes from '@modules/propostas-internas/pi.routes';
import contratoRoutes from '@modules/contratos/contrato.routes';
import contractsV4Routes from '@modules/contratos/contracts-v4.routes';
import boardContractsV4Routes from '@modules/contratos/board-contracts-v4.routes';
import biWeekRoutes from '@modules/biweeks/biWeeks.routes';
import webhookRoutes from '@modules/webhooks/webhook.routes';
import publicApiRoutes from '@modules/public-api/public-api.routes';
import publicApiV1Routes from '@modules/public-api/public-api-v1.routes';
import relatorioRoutes from '@modules/relatorios/relatorios.routes';
import whatsappRoutes from '@modules/whatsapp/whatsapp.routes';
import adminRoutes from '@modules/admin/admin.routes';
import checkingRoutes from '@modules/checking/checking.routes';
import queueRoutes from '@modules/system/queue/queue.routes';
import sseRoutes from '@modules/system/sse/sse.routes';
import realtimeHealthRoutes from '@modules/system/realtime-health.routes';
import syncRoutes from '@modules/sync/sync.routes';
import dashboardRoutes from '@modules/dashboard/dashboard.routes';
import auditRoutes from '@modules/audit/audit.routes';
import enterpriseBIRoutes from '@modules/enterprise-bi/enterprise-bi.routes';
import exportRoutes from '@modules/export/routes/export.routes';
import marketplaceRoutes from '@modules/marketplace/routes/marketplace.routes';
import inventoryRoutes from '@modules/inventory/inventory.routes';
import realtimeRoutes from '@modules/realtime/realtime.routes';
import sessionV4Routes from '@modules/auth/session-v4.routes';
import dashboardV4Routes from '@modules/dashboard/dashboard-v4.routes';
import commercialV4Routes from '@modules/commercial/commercial-v4.routes';
import reportsV4Routes from '@modules/relatorios/reports-v4.routes';
import alertsV4Routes from '@modules/alerts/alerts-v4.routes';
import operationsV4Routes from '@modules/operations/operations-v4.routes';
import featuresV4Routes from '@modules/features/features-v4.routes';
import activityV4Routes from '@modules/activity/activity-v4.routes';
import campaignsV4Routes from '@modules/campaigns/campaigns-v4.routes';
import rbacRoutes from '@modules/auth/rbac.routes';
import temporalRoutes from '@modules/temporal/temporal.routes';
import regionsRoutes from '@modules/regions/regions.routes';
import clientsV4Routes from '@modules/clientes/clients.routes';
import mediaRoutes from '@modules/media/media.routes';
import publicPlatesRoutes from '@modules/public-plates/public-plates.routes';

export interface ModuleDefinition {
  name: string;
  basePath: string;
  router: Router;
  description: string;
  domain: string;
  version: string;
  enabled: boolean;
}

export const modules: ModuleDefinition[] = [
  {
    name: 'auth',
    basePath: '/api/v1/auth',
    router: authRoutes,
    description: 'Autenticacao e autorizacao de usuarios',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'users',
    basePath: '/api/v1/user',
    router: userRoutes,
    description: 'Gestao de usuarios do sistema',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'users-alias',
    basePath: '/api/v1/users',
    router: userRoutes,
    description: 'Alias plural para gestao de usuarios',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'empresas',
    basePath: '/api/v1/empresas',
    router: empresaRoutes,
    description: 'Gestao de empresas multi-tenant',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'empresa-alias',
    basePath: '/api/v1/empresa',
    router: empresaRoutes,
    description: 'Alias para empresas por compatibilidade',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'empresa-public',
    basePath: '/api/v1/public/empresas',
    router: empresaPublicRoutes,
    description: 'Rotas publicas de empresas',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'admin',
    basePath: '/api/v1/admin',
    router: adminRoutes,
    description: 'Funcionalidades administrativas',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'audit',
    basePath: '/api/v1/audit',
    router: auditRoutes,
    description: 'Auditoria multi-tenant de acoes criticas',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'placas',
    basePath: '/api/v1/placas',
    router: placaRoutes,
    description: 'Gestao de placas publicitarias',
    domain: 'asset-management',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'regioes',
    basePath: '/api/v1/regioes',
    router: regiaoRoutes,
    description: 'Gestao de regioes geograficas',
    domain: 'asset-management',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'clientes',
    basePath: '/api/v1/clientes',
    router: clienteRoutes,
    description: 'Gestao de clientes',
    domain: 'crm',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'alugueis',
    basePath: '/api/v1/alugueis',
    router: aluguelRoutes,
    description: 'Gestao de alugueis de placas',
    domain: 'crm',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'propostas-internas',
    basePath: '/api/v1/pis',
    router: piRoutes,
    description: 'Propostas internas',
    domain: 'sales',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'contratos',
    basePath: '/api/v1/contratos',
    router: contratoRoutes,
    description: 'Gestao de contratos formais',
    domain: 'sales',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'biweeks',
    basePath: '/api/v1/bi-weeks',
    router: biWeekRoutes,
    description: 'Sistema de quinzenas e periodos',
    domain: 'sales',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'webhooks',
    basePath: '/api/v1/webhooks',
    router: webhookRoutes,
    description: 'Sistema de webhooks',
    domain: 'integration',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'public-api',
    basePath: '/api/v1/public',
    router: publicApiRoutes,
    description: 'API publica para parceiros (legacy path — mantido para compatibilidade)',
    domain: 'integration',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'public-api-v1',
    basePath: '/public/v1',
    router: publicApiV1Routes,
    description: 'API publica de integracao — caminho canonico externo (/public/v1)',
    domain: 'integration',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'public-plates',
    basePath: '/api/public',
    router: publicPlatesRoutes,
    description: 'API publica de placas para WordPress e integrações externas',
    domain: 'integration',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'whatsapp',
    basePath: '/api/v1/whatsapp',
    router: whatsappRoutes,
    description: 'Integracao com WhatsApp',
    domain: 'integration',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'relatorios',
    basePath: '/api/v1/relatorios',
    router: relatorioRoutes,
    description: 'Relatorios e dashboards',
    domain: 'analytics',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'dashboard',
    basePath: '/api/v1/dashboard',
    router: dashboardRoutes,
    description: 'Central de decisao comercial e operacional',
    domain: 'analytics',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'inventory-v4',
    basePath: '/api/v4/inventory',
    router: inventoryRoutes,
    description: 'Resumo operacional real do inventario v4',
    domain: 'analytics',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'inventory-v1-alias',
    basePath: '/api/v1/inventory',
    router: inventoryRoutes,
    description: 'Alias compatível para resumo operacional do inventario',
    domain: 'analytics',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'contracts-v4',
    basePath: '/api/v4/contracts',
    router: contractsV4Routes,
    description: 'Resumo e carteira operacional de contratos v4 baseada em alugueis',
    domain: 'sales',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'contracts-v1-summary-alias',
    basePath: '/api/v1/contracts',
    router: contractsV4Routes,
    description: 'Alias compativel para contratos operacionais v4',
    domain: 'sales',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'board-contracts-v4',
    basePath: '/api/v4/boards',
    router: boardContractsV4Routes,
    description: 'Contratos operacionais por placa para o painel v4',
    domain: 'sales',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'auth-v4',
    basePath: '/api/v4/auth',
    router: sessionV4Routes,
    description: 'Sessão autenticada V4 com permissões harmonizadas para o Sync Core',
    domain: 'core',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'dashboard-v4',
    basePath: '/api/v4/dashboard',
    router: dashboardV4Routes,
    description: 'Dashboard V4: fachada sobre endpoints v1 com paths harmonizados para o Sync Core',
    domain: 'analytics',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'temporal-v4',
    basePath: '/api/v4/temporal',
    router: temporalRoutes,
    description: 'Engine temporal V4.1: disponibilidade, reservas, bloqueios e conflitos de placas',
    domain: 'asset-management',
    version: '4.1.0',
    enabled: true,
  },
  {
    name: 'regions-v4',
    basePath: '/api/v4/regions',
    router: regionsRoutes,
    description: 'Region Manager V4.1: dominio territorial formal para placas, mapa e dashboard',
    domain: 'asset-management',
    version: '4.1.0',
    enabled: true,
  },
  {
    name: 'clients-v4',
    basePath: '/api/v4/clients',
    router: clientsV4Routes,
    description: 'Client Core Registry V4.1: registro canônico de clientes para PI e Contratos',
    domain: 'crm',
    version: '4.1.0',
    enabled: true,
  },
  {
    name: 'media-v4',
    basePath: '/api/v4/media',
    router: mediaRoutes,
    description: 'Media Core V4.1: upload, metadata, R2, lifecycle e cleanup de assets',
    domain: 'asset-management',
    version: '4.1.0',
    enabled: true,
  },
  {
    name: 'features-v4',
    basePath: '/api/v4/features',
    router: featuresV4Routes,
    description: 'Feature flags V4 por tenant — rollout controlado do painel V4',
    domain: 'core',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'alerts-v4',
    basePath: '/api/v4/alerts',
    router: alertsV4Routes,
    description: 'Alertas operacionais V4: list, summary, critical, unread, by-domain (stub real)',
    domain: 'operations',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'operations-v4',
    basePath: '/api/v4/operations',
    router: operationsV4Routes,
    description: 'Operações V4: timeline, summary, tasks, pending, by-domain (stub real)',
    domain: 'operations',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'commercial-v4',
    basePath: '/api/v4/commercial',
    router: commercialV4Routes,
    description: 'Pipeline comercial V4: oportunidades, propostas e conversões (stub real)',
    domain: 'sales',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'reports-v4',
    basePath: '/api/v4/reports',
    router: reportsV4Routes,
    description: 'Relatórios V4: sumário, analytics, exports e agrupamentos (stub real)',
    domain: 'analytics',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'activity-v4',
    basePath: '/api/v4/activity',
    router: activityV4Routes,
    description: 'Atividade V4: timeline global, feed, auditoria e agrupamento por domínio',
    domain: 'operations',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'campaigns-v4',
    basePath: '/api/v4/campaigns',
    router: campaignsV4Routes,
    description: 'Campanhas V4: summary, list, active, scheduled, performance e mutations CRUD',
    domain: 'sales',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'realtime-v4',
    basePath: '/api/v4/realtime',
    router: realtimeRoutes,
    description: 'Gateway SSE de eventos operacionais em tempo real do painel v4',
    domain: 'system',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'system-v4',
    basePath: '/api/v4/system',
    router: realtimeHealthRoutes,
    description: 'Observabilidade v4 e health operacional de realtime',
    domain: 'system',
    version: '4.0.0',
    enabled: true,
  },
  {
    name: 'checking',
    basePath: '/api/v1/checking',
    router: checkingRoutes,
    description: 'Health checks e monitoramento',
    domain: 'system',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'queue',
    basePath: '/api/v1/queue',
    router: queueRoutes,
    description: 'Fila de jobs e geracao assincrona de PDFs',
    domain: 'system',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'sse',
    basePath: '/api/v1/sse',
    router: sseRoutes,
    description: 'Server sent events em tempo real',
    domain: 'system',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'sync',
    basePath: '/api/v1/sync',
    router: syncRoutes,
    description: 'Operational Sync Layer',
    domain: 'system',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'enterprise-bi',
    basePath: '/api/v1/enterprise-bi',
    router: enterpriseBIRoutes,
    description: 'Enterprise BI Layer',
    domain: 'analytics',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'export',
    basePath: '/api/v1/exports',
    router: exportRoutes,
    description: 'Export Layer',
    domain: 'analytics',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'marketplace',
    basePath: '/api/v1/marketplace',
    router: marketplaceRoutes,
    description: 'Tenant Capability Marketplace interno',
    domain: 'analytics',
    version: '1.0.0',
    enabled: true,
  },
  {
    name: 'rbac',
    basePath: '/api/v1/rbac',
    router: rbacRoutes,
    description: 'RBAC — listagem de roles, permissões e permissões do usuário corrente',
    domain: 'core',
    version: '1.0.0',
    enabled: true,
  },
];

export function getModulesByDomain(): Map<string, ModuleDefinition[]> {
  const byDomain = new Map<string, ModuleDefinition[]>();

  modules.forEach((module) => {
    if (!byDomain.has(module.domain)) {
      byDomain.set(module.domain, []);
    }
    byDomain.get(module.domain)!.push(module);
  });

  return byDomain;
}

export function getModuleByName(name: string): ModuleDefinition | undefined {
  return modules.find((module) => module.name === name);
}

export function getEnabledModules(): ModuleDefinition[] {
  return modules.filter((module) => module.enabled);
}

export function getModuleStats() {
  const byDomain = getModulesByDomain();
  return {
    total: modules.length,
    enabled: modules.filter((module) => module.enabled).length,
    disabled: modules.filter((module) => !module.enabled).length,
    domains: Array.from(byDomain.entries()).map(([domain, mods]) => ({
      domain,
      count: mods.length,
      modules: mods.map((module) => ({ name: module.name, enabled: module.enabled })),
    })),
  };
}
