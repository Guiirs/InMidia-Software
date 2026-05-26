export const dashboardV4MockData = {
  generatedAt: '2026-05-18T18:00:00Z',
  header: {
    title: 'Dashboard Operacional v4',
    subtitle: 'Cockpit executivo para validacao visual antes da integracao real',
    description: 'Tela de apresentacao isolada com dados mockados realistas, sem acoplamento com API, React Query ou servicos reais.'
  },
  periodOptions: [
    { value: '7d', label: 'Ultimos 7 dias' },
    { value: '30d', label: 'Ultimos 30 dias' },
    { value: '90d', label: 'Ultimos 90 dias' },
    { value: 'ytd', label: 'Ano atual' }
  ],
  regionOptions: [
    { value: 'todas', label: 'Todas as regioes' },
    { value: 'sudeste', label: 'Sudeste' },
    { value: 'sul', label: 'Sul' },
    { value: 'centro-oeste', label: 'Centro-Oeste' },
    { value: 'nordeste', label: 'Nordeste' }
  ],
  overviewCards: [
    {
      id: 'pipeline-health',
      label: 'Saude de pipeline',
      value: '92%',
      detail: 'Estagios com SLA dentro da meta',
      trend: '+4 p.p.',
      tone: 'success'
    },
    {
      id: 'fleet-availability',
      label: 'Disponibilidade de frota',
      value: '81,7%',
      detail: 'Placas aptas para nova locacao',
      trend: '-1,2 p.p.',
      tone: 'warning'
    },
    {
      id: 'revenue-quality',
      label: 'Qualidade de receita',
      value: 'R$ 418 mil',
      detail: 'Receita liquida recorrente estimada',
      trend: '+7,8%',
      tone: 'info'
    },
    {
      id: 'risk-pressure',
      label: 'Pressao de risco',
      value: '13 contratos',
      detail: 'Contratos com atraso acima de 5 dias',
      trend: '-2 contratos',
      tone: 'default'
    }
  ],
  kpis: [
    { id: 'billing', label: 'Faturamento do ciclo', value: 'R$ 1,28M', change: '+8,4% vs periodo anterior', trend: 'up' },
    { id: 'occupancy', label: 'Taxa de ocupacao', value: '81,2%', change: '+2,1 p.p.', trend: 'up' },
    { id: 'new-rentals', label: 'Novas locacoes', value: '146', change: '+18 contratos', trend: 'up' },
    { id: 'sla', label: 'SLA de resposta', value: '2h 18m', change: '+14m', trend: 'down' },
    { id: 'churn-risk', label: 'Risco de churn', value: '4,9%', change: '-0,7 p.p.', trend: 'up' },
    { id: 'sync-health', label: 'Saude de sync', value: '97,3%', change: '+0,6 p.p.', trend: 'up' }
  ],
  alerts: [
    {
      id: 'alert-01',
      level: 'warning',
      title: 'Fila comercial acima do limite',
      detail: '17 propostas em analise ha mais de 48h no polo Sudeste.',
      owner: 'Squad Comercial',
      sla: 'Ate 19:00'
    },
    {
      id: 'alert-02',
      level: 'error',
      title: 'Placas ociosas em crescimento',
      detail: 'Lote de 23 placas com ociosidade acima de 20 dias no Sul.',
      owner: 'Operacao Regional',
      sla: 'Imediato'
    },
    {
      id: 'alert-03',
      level: 'info',
      title: 'Campanha com alta conversao',
      detail: 'Canal marketplace entregou +14,2% de conversao no periodo.',
      owner: 'Marketing Growth',
      sla: 'Monitorar'
    },
    {
      id: 'alert-04',
      level: 'warning',
      title: 'Latencia elevada no replay',
      detail: 'Tempo medio de sincronizacao subiu para 3m12s no fim da tarde.',
      owner: 'Plataforma Dados',
      sla: 'Ate 17:30'
    }
  ],
  regionPerformance: [
    {
      id: 'rg-se',
      region: 'Sudeste',
      revenue: 'R$ 418 mil',
      occupancy: 86,
      utilization: 'Alta',
      latency: '1m 08s',
      syncHealth: 'saudavel',
      delta: '+9,2%'
    },
    {
      id: 'rg-s',
      region: 'Sul',
      revenue: 'R$ 247 mil',
      occupancy: 79,
      utilization: 'Moderada',
      latency: '2m 21s',
      syncHealth: 'atencao',
      delta: '+4,1%'
    },
    {
      id: 'rg-co',
      region: 'Centro-Oeste',
      revenue: 'R$ 184 mil',
      occupancy: 74,
      utilization: 'Moderada',
      latency: '1m 49s',
      syncHealth: 'saudavel',
      delta: '+2,8%'
    },
    {
      id: 'rg-ne',
      region: 'Nordeste',
      revenue: 'R$ 163 mil',
      occupancy: 68,
      utilization: 'Baixa',
      latency: '3m 04s',
      syncHealth: 'critico',
      delta: '-1,3%'
    }
  ],
  topBoards: [
    { id: 'tb-1001', code: 'ABC-4D21', city: 'Sao Paulo', region: 'sudeste', rentals: 38, revenue: 'R$ 24,3 mil', occupancy: '97%', status: 'saudavel' },
    { id: 'tb-1002', code: 'KLM-9R08', city: 'Campinas', region: 'sudeste', rentals: 34, revenue: 'R$ 21,8 mil', occupancy: '95%', status: 'saudavel' },
    { id: 'tb-1003', code: 'QWE-1N76', city: 'Curitiba', region: 'sul', rentals: 30, revenue: 'R$ 19,4 mil', occupancy: '91%', status: 'atencao' },
    { id: 'tb-1004', code: 'MNO-7P11', city: 'Goiania', region: 'centro-oeste', rentals: 28, revenue: 'R$ 17,9 mil', occupancy: '89%', status: 'saudavel' },
    { id: 'tb-1005', code: 'ZXC-2V45', city: 'Fortaleza', region: 'nordeste', rentals: 24, revenue: 'R$ 15,6 mil', occupancy: '86%', status: 'atencao' }
  ],
  idleBoards: [
    { id: 'ib-2001', code: 'HJK-5T40', region: 'sul', daysIdle: 29, potential: 'R$ 3,8 mil', action: 'Realocar para hub central', priority: 'alta' },
    { id: 'ib-2002', code: 'POI-6Y73', region: 'nordeste', daysIdle: 24, potential: 'R$ 2,9 mil', action: 'Revisar precificacao local', priority: 'media' },
    { id: 'ib-2003', code: 'ASD-8U22', region: 'centro-oeste', daysIdle: 21, potential: 'R$ 2,4 mil', action: 'Acionar campanha regional', priority: 'media' },
    { id: 'ib-2004', code: 'FGH-3L90', region: 'sudeste', daysIdle: 18, potential: 'R$ 2,1 mil', action: 'Ajustar portfolio ativo', priority: 'baixa' }
  ],
  commercialFunnel: [
    { id: 'fn-01', stage: 'Leads qualificados', volume: 624, rate: 100, value: 'R$ 2,31M', delta: '+6,4%' },
    { id: 'fn-02', stage: 'Propostas enviadas', volume: 386, rate: 62, value: 'R$ 1,44M', delta: '+4,9%' },
    { id: 'fn-03', stage: 'Negociacao ativa', volume: 219, rate: 35, value: 'R$ 972 mil', delta: '+3,2%' },
    { id: 'fn-04', stage: 'Contrato fechado', volume: 146, rate: 23, value: 'R$ 618 mil', delta: '+2,1%' }
  ],
  recentActivity: [
    {
      id: 'act-01',
      occurredAt: '18:42',
      actor: 'Ana Lima',
      action: 'Repriorizou lote de placas ociosas',
      context: 'Sul - lote #SUL-22',
      channel: 'Operacoes',
      status: 'success'
    },
    {
      id: 'act-02',
      occurredAt: '18:36',
      actor: 'Rafael Costa',
      action: 'Ajustou regra de roteamento comercial',
      context: 'Sudeste - canal enterprise',
      channel: 'Comercial',
      status: 'info'
    },
    {
      id: 'act-03',
      occurredAt: '18:24',
      actor: 'Plataforma Dados',
      action: 'Concluiu replay de eventos pendentes',
      context: 'Janela 17:30-18:20',
      channel: 'Sync',
      status: 'warning'
    },
    {
      id: 'act-04',
      occurredAt: '18:10',
      actor: 'Marina Alves',
      action: 'Aprovou pacote de proposta prioritario',
      context: '11 contratos | ticket medio alto',
      channel: 'Financeiro',
      status: 'success'
    }
  ],
  sync: {
    mode: 'SSE com fallback para polling',
    status: 'atencao',
    lastEvent: 'PLACA_STATUS_CHANGED',
    lastEventAt: '2026-05-18 17:58:42',
    replayQueue: 9,
    reconnectAttempts: 2,
    eventLag: '3m 12s',
    uptime: '99,82%',
    workers: 6,
    incidentLevel: 'moderado',
    sources: [
      { id: 'src-01', name: 'core-events', status: 'saudavel', throughput: '1.420 ev/min' },
      { id: 'src-02', name: 'inventory-sync', status: 'atencao', throughput: '780 ev/min' },
      { id: 'src-03', name: 'marketplace-feed', status: 'saudavel', throughput: '508 ev/min' }
    ]
  }
};
