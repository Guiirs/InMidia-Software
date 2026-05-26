export const reportsStateOptionsV4 = [
  { value: 'default', label: 'Exibição padrão' },
  { value: 'loading', label: 'Carregando' },
  { value: 'empty', label: 'Sem dados' },
  { value: 'error', label: 'Com falha' }
];

export const reportsPeriodOptionsV4 = [
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'ytd', label: 'Ano atual' },
  { value: '12m', label: 'Últimos 12 meses' }
];

export const reportsRegionOptionsV4 = [
  { value: 'todas', label: 'Todas as regiões' },
  { value: 'centro', label: 'Centro Expandido' },
  { value: 'norte', label: 'Norte' },
  { value: 'sul', label: 'Sul' },
  { value: 'leste', label: 'Leste' },
  { value: 'oeste', label: 'Oeste' }
];

export const reportsCityOptionsV4 = [
  { value: 'todas', label: 'Todas as cidades' },
  { value: 'sao-paulo', label: 'São Paulo' },
  { value: 'osasco', label: 'Osasco' },
  { value: 'guarulhos', label: 'Guarulhos' },
  { value: 'santo-andre', label: 'Santo André' }
];

export const reportsStatusOptionsV4 = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'saudavel', label: 'Saudável' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'critico', label: 'Crítico' }
];

export const reportsGroupingOptionsV4 = [
  { value: 'regiao', label: 'Agrupar por regiao' },
  { value: 'cidade', label: 'Agrupar por cidade' },
  { value: 'status', label: 'Agrupar por status' },
  { value: 'canal', label: 'Agrupar por canal' }
];

export const reportsHeaderV4 = {
  title: 'Relatórios v4',
  subtitle: 'Cockpit executivo de performance operacional',
  description: 'Camada isolada para validar narrativas analíticas enterprise sem dependência de dados reais ou BI oficial.'
};

export const reportsKpisV4 = [
  { id: 'faturamento', label: 'Faturamento', value: 'R$ 2,84M', change: '+9,6% vs periodo anterior', trend: 'up' },
  { id: 'ocupacao', label: 'Ocupação', value: '83,4%', change: '+2,3 p.p.', trend: 'up' },
  { id: 'crescimento', label: 'Crescimento', value: '12,1%', change: 'aceleração trimestral', trend: 'up' },
  { id: 'online', label: 'Ativos online', value: '417', change: '98,4% em operação', trend: 'neutral' },
  { id: 'disponibilidade', label: 'Disponibilidade', value: '91,2%', change: '+1,1 p.p.', trend: 'up' },
  { id: 'contratos', label: 'Contratos ativos', value: '286', change: '+17 no mês', trend: 'up' }
];

export const reportsSeriesV4 = [
  { month: 'Jan', faturamento: 1.92, ocupacao: 71, disponibilidade: 86 },
  { month: 'Fev', faturamento: 2.04, ocupacao: 74, disponibilidade: 88 },
  { month: 'Mar', faturamento: 2.16, ocupacao: 76, disponibilidade: 89 },
  { month: 'Abr', faturamento: 2.31, ocupacao: 79, disponibilidade: 90 },
  { month: 'Mai', faturamento: 2.45, ocupacao: 81, disponibilidade: 91 },
  { month: 'Jun', faturamento: 2.58, ocupacao: 82, disponibilidade: 92 },
  { month: 'Jul', faturamento: 2.71, ocupacao: 83, disponibilidade: 92 },
  { month: 'Ago', faturamento: 2.84, ocupacao: 83, disponibilidade: 91 }
];

export const reportsMonthlyComparisonV4 = [
  { metric: 'Receita liquida', current: 'R$ 2,84M', previous: 'R$ 2,59M', delta: '+9,7%' },
  { metric: 'Novos contratos', current: '37', previous: '29', delta: '+27,6%' },
  { metric: 'Churn comercial', current: '2,1%', previous: '2,9%', delta: '-0,8 p.p.' },
  { metric: 'SLA de ativação', current: '18h', previous: '23h', delta: '-5h' }
];

export const reportsRegionalRankingV4 = [
  { id: 'reg-1', name: 'Centro Expandido', revenue: 'R$ 912k', occupancy: '89%', growth: '+11,2%', status: 'saudavel' },
  { id: 'reg-2', name: 'Oeste', revenue: 'R$ 608k', occupancy: '82%', growth: '+8,9%', status: 'saudavel' },
  { id: 'reg-3', name: 'Norte', revenue: 'R$ 494k', occupancy: '78%', growth: '+6,1%', status: 'atencao' },
  { id: 'reg-4', name: 'Leste', revenue: 'R$ 436k', occupancy: '74%', growth: '+4,8%', status: 'atencao' },
  { id: 'reg-5', name: 'Sul', revenue: 'R$ 390k', occupancy: '71%', growth: '+3,7%', status: 'critico' }
];

export const reportsBoardRankingV4 = [
  {
    id: 'placa-001',
    code: 'SP-PAU-011',
    location: 'Av. Paulista, 1220',
    city: 'São Paulo',
    revenue: 'R$ 84k',
    occupancy: '96%',
    trend: '+8,4%',
    status: 'saudavel'
  },
  {
    id: 'placa-002',
    code: 'SP-MAR-034',
    location: 'Marginal Pinheiros, 4900',
    city: 'São Paulo',
    revenue: 'R$ 71k',
    occupancy: '88%',
    trend: '+6,9%',
    status: 'saudavel'
  },
  {
    id: 'placa-003',
    code: 'OSA-CST-022',
    location: 'Rod. Castello Branco, km 19',
    city: 'Osasco',
    revenue: 'R$ 64k',
    occupancy: '83%',
    trend: '+5,1%',
    status: 'atencao'
  },
  {
    id: 'placa-004',
    code: 'GRU-LN-017',
    location: 'Rod. Fernao Dias, km 84',
    city: 'Guarulhos',
    revenue: 'R$ 58k',
    occupancy: '79%',
    trend: '+3,8%',
    status: 'atencao'
  },
  {
    id: 'placa-005',
    code: 'SA-EST-009',
    location: 'Av. dos Estados, 2100',
    city: 'Santo André',
    revenue: 'R$ 41k',
    occupancy: '62%',
    trend: '-2,4%',
    status: 'critico'
  }
];

export const reportsCommercialSummaryV4 = [
  { id: 'pipeline', label: 'Pipeline qualificado', value: 'R$ 1,74M', note: '31 oportunidades em negociação' },
  { id: 'ticket', label: 'Ticket médio', value: 'R$ 34,8k', note: '+6,3% vs trimestre anterior' },
  { id: 'upsell', label: 'Upsell potencial', value: 'R$ 420k', note: '14 contas com janela ativa' },
  { id: 'renovacao', label: 'Renovação 60 dias', value: '82%', note: '12 contratos em tratativa' }
];

export const reportsOperationalFunnelV4 = [
  { id: 'leads', label: 'Leads avaliados', value: 640, conversion: 100 },
  { id: 'propostas', label: 'Propostas emitidas', value: 292, conversion: 45.6 },
  { id: 'negociacao', label: 'Em negociação', value: 166, conversion: 25.9 },
  { id: 'aprovacao', label: 'Aprovação financeira', value: 121, conversion: 18.9 },
  { id: 'ativação', label: 'Ativações concluídas', value: 103, conversion: 16.1 }
];

export const reportsExecutiveRowsV4 = [
  {
    id: 'row-1',
    segment: 'OOH Premium',
    receita: 'R$ 1,12M',
    margem: '31,4%',
    ocupacao: '91%',
    disponibilidade: '95%',
    status: 'saudavel'
  },
  {
    id: 'row-2',
    segment: 'OOH Urbano',
    receita: 'R$ 954k',
    margem: '28,2%',
    ocupacao: '84%',
    disponibilidade: '89%',
    status: 'saudavel'
  },
  {
    id: 'row-3',
    segment: 'OOH Perimetral',
    receita: 'R$ 512k',
    margem: '24,6%',
    ocupacao: '77%',
    disponibilidade: '86%',
    status: 'atencao'
  },
  {
    id: 'row-4',
    segment: 'OOH Expansao',
    receita: 'R$ 262k',
    margem: '19,1%',
    ocupacao: '63%',
    disponibilidade: '79%',
    status: 'critico'
  }
];
