/* ═══════════════════════════════════════════════════════════════
   DASHBOARD — CONTRATO DE INTEGRAÇÃO FUTURA
   Define o formato de dados que o backend deverá fornecer
   para substituir os mocks da DashboardPage.

   CLASSIFICAÇÃO DOS CAMPOS:
   → existente    = já existe na API atual (verificar campo exato)
   → derivado     = calculado a partir de dados existentes
   → novo         = precisa ser criado no backend
   → parcial      = existe mas formato diferente
═══════════════════════════════════════════════════════════════ */

export const DASHBOARD_DATA_CONTRACT = {
  /* ── Métricas de Inventário ──────────────────────────────────── */
  inventoryMetrics: {
    _origin: 'endpoint: GET /api/inventory/summary',
    totalBoards:     { type:'number',  origin:'existente', field:'total_placas'     },
    occupiedBoards:  { type:'number',  origin:'existente', field:'placas_ocupadas'  },
    availableBoards: { type:'number',  origin:'derivado',  formula:'total - occupied - maintenance - reserved' },
    inMaintenance:   { type:'number',  origin:'existente', field:'em_manutencao'    },
    reserved:        { type:'number',  origin:'existente', field:'reservadas'       },
    occupancyRate:   { type:'number',  origin:'derivado',  formula:'occupied / total', format:'0.000' },
  },

  /* ── Métricas Financeiras ────────────────────────────────────── */
  revenueMetrics: {
    _origin: 'endpoint: GET /api/commercial/revenue/summary',
    projectedRevenue:    { type:'number', origin:'novo',     description:'Receita projetada do mês corrente' },
    realizedRevenue:     { type:'number', origin:'existente',field:'receita_realizada' },
    monthlyTarget:       { type:'number', origin:'novo',     description:'Meta mensal configurada por período' },
    targetAchievement:   { type:'number', origin:'derivado', formula:'realized / target' },
    revenueGrowthMoM:    { type:'number', origin:'derivado', formula:'(current - previous) / previous' },
  },

  /* ── Métricas de Contratos ───────────────────────────────────── */
  contractMetrics: {
    _origin: 'endpoint: GET /api/contracts/summary',
    activeContracts:     { type:'number', origin:'existente', field:'contratos_ativos'     },
    expiringIn30Days:    { type:'number', origin:'derivado',  formula:'count(vencimento <= today + 30d)' },
    renewedThisMonth:    { type:'number', origin:'derivado',  formula:'count(renovado where mes = current)' },
    criticalAlerts:      { type:'number', origin:'novo',      description:'Contratos com risco crítico identificado' },
  },

  /* ── Alertas Operacionais ────────────────────────────────────── */
  alerts: {
    _origin: 'endpoint: GET /api/alerts/active ou SSE /api/alerts/stream',
    items: {
      type:   'Array<Alert>',
      origin: 'parcial',
      shape: {
        id:          'string',
        titulo:      { origin:'novo', description:'Texto curto em linguagem operacional' },
        descricao:   { origin:'novo', description:'Descrição completa do alerta' },
        severidade:  { origin:'existente', field:'severity', enum:['info','low','medium','high','critical'] },
        estado:      { origin:'derivado',  formula:'mapSeverityToState(severidade)' },
        categoria:   { origin:'novo',      enum:['operacional','comercial','sistema','regional','contrato','manutencao'] },
        sla:         { origin:'novo',      description:'Tempo máximo de resposta' },
        owner:       { origin:'novo',      description:'Responsável pelo alerta' },
        impacto:     { origin:'novo',      description:'Descrição do impacto financeiro/operacional' },
        status:      { origin:'existente', enum:['Aberto','Em andamento','Monitorando','Sincronizando','Resolvido'] },
        lido:        { origin:'novo',      type:'boolean' },
        acao:        { origin:'novo',      description:'Ação em andamento ou recomendada' },
        timestamp:   { origin:'existente', field:'created_at', format:'ISO 8601' },
      },
    },
  },

  /* ── Desempenho Regional ─────────────────────────────────────── */
  regionalPerformance: {
    _origin: 'endpoint: GET /api/inventory/regional-summary',
    items: {
      type:   'Array<RegionalData>',
      origin: 'parcial',
      shape: {
        id:               { origin:'existente', field:'regiao_id'              },
        label:            { origin:'existente', field:'regiao_nome'            },
        placasTotal:      { origin:'existente', field:'total_placas'           },
        placasOcupadas:   { origin:'existente', field:'placas_ocupadas'        },
        ocupacao:         { origin:'derivado',  formula:'ocupadas / total'     },
        receitaAtiva:     { origin:'existente', field:'receita_ativa_mensal'   },
        estado:           { origin:'derivado',  formula:'mapOccupancyToState(ocupacao)' },
        heatLevel:        { origin:'derivado',  formula:'Math.round(ocupacao * 5)'      },
        tendencia:        { origin:'novo',       description:'crescimento|estável|queda' },
      },
    },
  },

  /* ── Atividade Recente ───────────────────────────────────────── */
  recentActivity: {
    _origin: 'endpoint: GET /api/activity/recent?limit=10',
    items: {
      type:   'Array<ActivityItem>',
      origin: 'parcial',
      shape: {
        id:       { origin:'existente' },
        tipo:     { origin:'existente', field:'event_type' },
        label:    { origin:'novo',      description:'Texto descritivo em linguagem operacional' },
        regiao:   { origin:'existente', field:'regiao_nome' },
        tempo:    { origin:'derivado',  formula:'formatRelativeTime(created_at)' },
        categoria:{ origin:'novo',      enum:['success','warning','info','danger'] },
      },
    },
  },

  /* ── Recomendações Operacionais ──────────────────────────────── */
  operationalRecommendations: {
    _origin: 'endpoint: GET /api/intelligence/recommendations (NOVO)',
    status:  'NOVO — precisa ser criado',
    items: {
      type:   'Array<Recommendation>',
      shape: {
        id:         'string',
        tipo:       'string — urgente|comercial|renovacao|regional|estrategico',
        titulo:     'string — max 60 chars, linguagem operacional',
        descricao:  'string — max 200 chars',
        impacto:    'string — valor financeiro ou percentual',
        prazo:      'string — "Hoje" | "Amanhã" | "Esta semana" | "Próximos X dias"',
        estado:     'OPERATIONAL_STATE enum',
        categoria:  'string',
      },
    },
  },
};

export const DASHBOARD_ENDPOINTS = [
  { method:'GET',  path:'/api/v4/dashboard/summary',          status:'novo',     description:'Sumarização completa da dashboard' },
  { method:'GET',  path:'/api/v4/inventory/summary',          status:'existente',description:'Resumo do inventário' },
  { method:'GET',  path:'/api/v4/commercial/revenue/summary', status:'novo',     description:'Resumo de receita e metas' },
  { method:'GET',  path:'/api/v4/contracts/summary',          status:'parcial',  description:'Resumo de contratos' },
  { method:'GET',  path:'/api/v4/alerts/active',              status:'novo',     description:'Alertas ativos com formato v4' },
  { method:'SSE',  path:'/api/v4/alerts/stream',              status:'novo',     description:'Stream de alertas em tempo real' },
  { method:'GET',  path:'/api/v4/intelligence/recommendations',status:'novo',    description:'Recomendações automáticas geradas' },
];
