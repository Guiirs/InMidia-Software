/* ═══════════════════════════════════════════════════════════════
   COMPONENT REGISTRY — V4 PAINEL GOVERNANCE
   Registro central de todos os componentes do sistema.
═══════════════════════════════════════════════════════════════ */

export const COMPONENT_CATEGORY = {
  DESIGN_SYSTEM: 'design-system',
  EXECUTIVE:     'executive',
  OPERATIONAL:   'operational',
  COMMERCIAL:    'commercial',
  CONTRACTS:     'contracts',
  REPORTS:       'reports',
  ALERTS:        'alerts',
  INVENTORY:     'inventory',
  MAP:           'map',
  CHARTS:        'charts',
  SHELL:         'shell',
  PREVIEW:       'preview',
};

export const COMPONENT_REGISTRY = [
  /* ── DESIGN SYSTEM ─────────────────────────────────────────── */
  { name:'OperationalCard',    category:COMPONENT_CATEGORY.DESIGN_SYSTEM, path:'design-system/cards/OperationalCard.jsx',    description:'Cartão base reutilizável para blocos de conteúdo operacional',     states:['default','elevated','interactive'],   memo:true },
  { name:'MetricCard',         category:COMPONENT_CATEGORY.DESIGN_SYSTEM, path:'design-system/cards/MetricCard.jsx',         description:'KPI com valor grande, tendência e estado operacional',            states:['healthy','warning','critical'],        memo:true },
  { name:'StatusBadge',        category:COMPONENT_CATEGORY.DESIGN_SYSTEM, path:'design-system/badges/StatusBadge.jsx',       description:'Badge de estado operacional com dot e semântica',                 states:['all-8-operational-states'],           memo:true },
  { name:'ActionButton',       category:COMPONENT_CATEGORY.DESIGN_SYSTEM, path:'design-system/buttons/ActionButton.jsx',     description:'Botão enterprise em 4 variantes e 3 tamanhos',                   states:['primary','secondary','danger','ghost'], memo:true },
  { name:'SectionHeader',      category:COMPONENT_CATEGORY.DESIGN_SYSTEM, path:'design-system/surfaces/SectionHeader.jsx',  description:'Cabeçalho de seção com título, subtítulo e ação',                 states:['default','with-action','no-divider'], memo:true },
  { name:'SurfacePanel',       category:COMPONENT_CATEGORY.DESIGN_SYSTEM, path:'design-system/surfaces/SurfacePanel.jsx',   description:'Superfície agrupadora de conteúdo relacionado',                   states:['default','noPad'],                    memo:true },
  { name:'EmptyState',         category:COMPONENT_CATEGORY.DESIGN_SYSTEM, path:'design-system/empty-states/EmptyState.jsx', description:'Estado vazio com ícone, texto e ação opcional',                   states:['default','compact'],                  memo:true },
  { name:'LoadingState',       category:COMPONENT_CATEGORY.DESIGN_SYSTEM, path:'design-system/loading/LoadingState.jsx',    description:'Skeleton animado para estados de carregamento',                   states:['default','compact'],                  memo:true },
  { name:'AlertCard',          category:COMPONENT_CATEGORY.DESIGN_SYSTEM, path:'design-system/alerts/AlertCard.jsx',        description:'Cartão de alerta operacional com severidade e dismiss',           states:['info','low','medium','high','critical'], memo:true },

  /* ── EXECUTIVE ─────────────────────────────────────────────── */
  { name:'KPIGrid',            category:COMPONENT_CATEGORY.EXECUTIVE,     path:'components/executive/KPIGrid.jsx',           description:'Grid de 8 KPIs com ícone, tendência e estado operacional',        states:['default'],                            memo:true },
  { name:'ExecutiveSummary',   category:COMPONENT_CATEGORY.EXECUTIVE,     path:'components/executive/ExecutiveSummary.jsx',  description:'Análise executiva em 4 blocos com badge "IA ATIVA"',              states:['default'],                            memo:true },
  { name:'RevenueProjectionCard',category:COMPONENT_CATEGORY.EXECUTIVE,   path:'components/executive/RevenueProjectionCard.jsx', description:'Projeção de receita com sparkline SVG e progresso para meta', states:['default'],                            memo:true },
  { name:'RegionalPerformanceCard',category:COMPONENT_CATEGORY.EXECUTIVE, path:'components/executive/RegionalPerformanceCard.jsx', description:'Desempenho regional com barra e heat indicator',            states:['default'],                            memo:true },
  { name:'OccupancyOverviewCard',category:COMPONENT_CATEGORY.EXECUTIVE,   path:'components/executive/OccupancyOverviewCard.jsx', description:'Donut ring SVG de ocupação global + barras por categoria',   states:['default'],                            memo:true },
  { name:'CommercialFunnelCard',category:COMPONENT_CATEGORY.EXECUTIVE,    path:'components/executive/CommercialFunnelCard.jsx', description:'Funil comercial com 5 etapas e conversão global',            states:['default'],                            memo:true },

  /* ── OPERATIONAL ───────────────────────────────────────────── */
  { name:'OperationsOverview', category:COMPONENT_CATEGORY.OPERATIONAL,   path:'components/operations/OperationsOverview.jsx', description:'Visão geral com barra de ocupação global e pills de métricas', states:['healthy','warning','critical'],       memo:true },
  { name:'RuntimeStatusBoard', category:COMPONENT_CATEGORY.OPERATIONAL,   path:'components/operations/RuntimeStatusBoard.jsx', description:'6 módulos com disponibilidade, tempo de resposta e estado',   states:['healthy','degraded','syncing'],       memo:true },
  { name:'RegionalOperationsGrid',category:COMPONENT_CATEGORY.OPERATIONAL,path:'components/operations/RegionalOperationsGrid.jsx','description':'Grid regional com ocupação, alertas e receita',          states:['default'],                            memo:true },
  { name:'SyncStatusPanel',    category:COMPONENT_CATEGORY.OPERATIONAL,   path:'components/operations/SyncStatusPanel.jsx',  description:'Sincronização por região com barra geral e divergências',        states:['healthy','warning'],                  memo:true },
  { name:'OperationalHealthPanel',category:COMPONENT_CATEGORY.OPERATIONAL,path:'components/operations/OperationalHealthPanel.jsx','description':'4 dimensões de saúde + mini lista de módulos',           states:['healthy','degraded'],                 memo:true },
  { name:'OperationsFeed',     category:COMPONENT_CATEGORY.OPERATIONAL,   path:'components/operations/OperationsFeed.jsx',   description:'Feed ao vivo mockado com 12 eventos e badge "AO VIVO"',          states:['default'],                            memo:true },

  /* ── INVENTORY ─────────────────────────────────────────────── */
  { name:'BoardStatusBadge',   category:COMPONENT_CATEGORY.INVENTORY,     path:'components/inventory/BoardStatusBadge.jsx',  description:'Badge com 5 status de placa: Ocupado, Disponível, Manutenção, Reservado, Crítico', states:['all-5-board-states'], memo:true },
  { name:'InventoryFilters',   category:COMPONENT_CATEGORY.INVENTORY,     path:'components/inventory/InventoryFilters.jsx',  description:'Busca + 4 seletores de filtro + resumo numérico',                states:['default'],                            memo:true },
  { name:'InventoryTable',     category:COMPONENT_CATEGORY.INVENTORY,     path:'components/inventory/InventoryTable.jsx',    description:'Tabela densa 9 colunas, sort e border-left de estado',           states:['default','sorted'],                   memo:true },
  { name:'BoardOperationalCard',category:COMPONENT_CATEGORY.INVENTORY,    path:'components/inventory/BoardOperationalCard.jsx','description':'Card com superfície visual de placa, campanha e recomendação',states:['all-operational'],                  memo:true },
  { name:'OccupancyDistribution',category:COMPONENT_CATEGORY.INVENTORY,   path:'components/inventory/OccupancyDistribution.jsx','description':'Barra segmentada + legenda das 5 categorias',              states:['default'],                            memo:true },
  { name:'BoardDetailsPanel',  category:COMPONENT_CATEGORY.INVENTORY,     path:'components/inventory/BoardDetailsPanel.jsx', description:'Painel lateral com detalhe completo de uma placa selecionada',   states:['empty','with-board'],                 memo:true },
];

export function getComponentsByCategory(category) {
  return COMPONENT_REGISTRY.filter(c => c.category === category);
}

export function getComponentByName(name) {
  return COMPONENT_REGISTRY.find(c => c.name === name) ?? null;
}

export const COMPONENT_SUMMARY = {
  total:         COMPONENT_REGISTRY.length,
  byCategory:    Object.fromEntries(
    Object.values(COMPONENT_CATEGORY).map(cat => [
      cat,
      COMPONENT_REGISTRY.filter(c => c.category === cat).length
    ])
  ),
  allMemo:       COMPONENT_REGISTRY.filter(c => c.memo).length,
};
