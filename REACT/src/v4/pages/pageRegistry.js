import { DashboardV4 } from './dashboard';
import { AuditV4 } from './audit';
import { HealthV4 } from './health';
import { BoardsPreviewV4 } from './boards';
import { InventoryV4 } from './inventory';
import { MapV4 } from './map';
import { ReportsV4 } from './reports';
import { ProposalsV4, ContractsV4 } from './commercial';
import { UsersV4 } from './users';
import { SettingsV4 } from './settings';
import { IntegrationsV4 } from './integrations';
import { MarketplaceV4 } from './marketplace';

export const pageRegistryV4 = [
  {
    id: 'dashboard',
    label: 'Dashboard Operacional v4',
    description: 'Visão consolidada de indicadores e acompanhamento de operação.',
    component: DashboardV4,
    futureRoute: '/dashboard',
    status: 'isolated',
    risk: 'medium',
    futureIntegrationNotes: 'Conectar dashboardService, assinatura de atualização e regras de permissão dashboard.read.'
  },
  {
    id: 'audit',
    label: 'Auditoria Operacional v4',
    description: 'Rastreabilidade de eventos com filtros e linha de ocorrências.',
    component: AuditV4,
    futureRoute: '/audit',
    status: 'isolated',
    risk: 'high',
    futureIntegrationNotes: 'Conectar auditService, filtros reais por usuário/ação/entidade/período e gate sync.diagnostics quando aplicável.'
  },
  {
    id: 'health',
    label: 'Saúde e Sincronização v4',
    description: 'Monitoramento operacional de disponibilidade e ritmo de atualização.',
    component: HealthV4,
    futureRoute: '/admin-sync',
    status: 'isolated',
    risk: 'high',
    futureIntegrationNotes: 'Conectar syncService, useSyncDiagnostics, leitura de /status e regras RBAC sync.diagnostics.'
  },
  {
    id: 'boards',
    label: 'Placas',
    description: 'Visual operacional dos ativos de mídia',
    component: BoardsPreviewV4,
    futureRoute: '/placas',
    status: 'isolated',
    risk: 'high',
    futureIntegrationNotes: 'Conectar placaService, aluguelService e sinais de syncService preservando filtros e paginação operacional.'
  },
  {
    id: 'inventory',
    label: 'Inventário',
    description: 'Gestão visual dos ativos de mídia',
    component: InventoryV4,
    futureRoute: '/placas',
    status: 'isolated',
    risk: 'high',
    futureIntegrationNotes: 'Conectar placaService, aluguelService e sinais de syncService preservando consistência entre filtros, mapa e BI.'
  },
  {
    id: 'map',
    label: 'Mapa',
    description: 'Visualização geográfica dos ativos de mídia',
    component: MapV4,
    futureRoute: '/map',
    status: 'isolated',
    risk: 'high',
    futureIntegrationNotes: 'Conectar camada geográfica com provider real de mapa, sinais de disponibilidade e regras operacionais sem acoplamento com página real nesta fase.'
  },
  {
    id: 'reports',
    label: 'Relatórios',
    description: 'Indicadores executivos e performance operacional',
    component: ReportsV4,
    futureRoute: '/analytics',
    status: 'isolated',
    risk: 'medium',
    futureIntegrationNotes: 'Conectar camada analítica oficial e fontes de BI sem alterar os contratos das páginas reais durante a fase de prototipação.'
  },
  {
    id: 'proposals',
    label: 'Propostas',
    description: 'Pipeline de propostas e aprovações comerciais',
    component: ProposalsV4,
    futureRoute: '/empresa-settings/propostas',
    status: 'isolated',
    risk: 'high',
    futureIntegrationNotes: 'Conectar pipeline comercial real, aprovações multi-etapa e permissões sem tocar PIsPage nesta fase.'
  },
  {
    id: 'contracts',
    label: 'Contratos',
    description: 'Gestão de contratos e vencimentos',
    component: ContractsV4,
    futureRoute: '/empresa-settings/contratos',
    status: 'isolated',
    risk: 'high',
    futureIntegrationNotes: 'Conectar contratos reais, regras de renovação e status financeiro sem alterar ContratosPage em prototipação.'
  },
  {
    id: 'users',
    label: 'Usuários',
    description: 'Gestão de usuários, perfis e permissões',
    component: UsersV4,
    futureRoute: '/admin-users',
    status: 'isolated',
    risk: 'high',
    futureIntegrationNotes: 'Conectar RBAC real, AuthContext e administração de usuários apenas depois da validação visual isolada.'
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Dados da empresa, preferências e operação',
    component: SettingsV4,
    futureRoute: '/empresa-settings',
    status: 'isolated',
    risk: 'medium',
    futureIntegrationNotes: 'Conectar EmpresaSettingsPage, preferências reais e permissões administrativas apenas após validação visual isolada.'
  },
  {
    id: 'integrations',
    label: 'Integrações',
    description: 'Chaves, webhooks e conectores operacionais',
    component: IntegrationsV4,
    futureRoute: '/empresa-settings/api',
    status: 'isolated',
    risk: 'high',
    futureIntegrationNotes: 'Conectar EmpresaApiKey, Marketplace e conectores reais apenas após validação visual isolada e revisão de segurança.'
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    description: 'Catálogo de módulos, integrações e capacidades',
    component: MarketplaceV4,
    futureRoute: '/marketplace',
    status: 'isolated',
    risk: 'medium',
    futureIntegrationNotes: 'Conectar MarketplacePage real e instalação de módulos apenas após validação visual isolada.'
  }
];
