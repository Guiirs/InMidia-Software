export const commercialStateOptionsV4 = [
  { value: 'default', label: 'Exibição padrão' },
  { value: 'loading', label: 'Carregando' },
  { value: 'empty', label: 'Sem dados' },
  { value: 'error', label: 'Com falha' }
];

export const commercialPeriodOptionsV4 = [
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'ytd', label: 'Ano atual' },
  { value: '12m', label: 'Últimos 12 meses' }
];

export const commercialRegionOptionsV4 = [
  { value: 'todas', label: 'Todas as regiões' },
  { value: 'centro', label: 'Centro Expandido' },
  { value: 'norte', label: 'Norte' },
  { value: 'sul', label: 'Sul' },
  { value: 'leste', label: 'Leste' },
  { value: 'oeste', label: 'Oeste' }
];

export const proposalsStatusOptionsV4 = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'aberta', label: 'Aberta' },
  { value: 'em-analise', label: 'Em análise' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'recusada', label: 'Recusada' }
];

export const proposalsOwnerOptionsV4 = [
  { value: 'todos', label: 'Todos os responsáveis' },
  { value: 'ana-rocha', label: 'Ana Rocha' },
  { value: 'bruno-lima', label: 'Bruno Lima' },
  { value: 'carla-mendes', label: 'Carla Mendes' },
  { value: 'diego-souza', label: 'Diego Souza' }
];

export const proposalsStageOptionsV4 = [
  { value: 'todos', label: 'Todos os estágios' },
  { value: 'lead', label: 'Lead qualificado' },
  { value: 'diagnostico', label: 'Diagnóstico' },
  { value: 'proposta', label: 'Proposta enviada' },
  { value: 'aprovacao', label: 'Aprovação financeira' },
  { value: 'fechamento', label: 'Fechamento' }
];

export const proposalsHeaderV4 = {
  title: 'Propostas v4',
  subtitle: 'Pipeline comercial e fluxo de aprovações',
  description: 'Superfície isolada para validar operação comercial sem acoplamento com página real de PIs.'
};

export const proposalsKpisV4 = [
  { id: 'pipeline', label: 'Pipeline total', value: 'R$ 4,62M', change: '+11,4% no ciclo', trend: 'up' },
  { id: 'propostas-abertas', label: 'Propostas abertas', value: '73', change: '14 em alta prioridade', trend: 'neutral' },
  { id: 'taxa-aprovacao', label: 'Taxa de aprovação', value: '68,2%', change: '+3,1 p.p.', trend: 'up' },
  { id: 'ticket', label: 'Ticket médio', value: 'R$ 37,5k', change: '+6,8%', trend: 'up' },
  { id: 'sla', label: 'SLA resposta', value: '16h', change: '-2h', trend: 'up' },
  { id: 'conversao', label: 'Conversão', value: '22,7%', change: '+1,9 p.p.', trend: 'up' }
];

export const proposalsWorkflowV4 = [
  {
    id: 'lead',
    label: 'Lead qualificado',
    amount: 'R$ 1,44M',
    items: [
      { id: 'p-101', title: 'Rede Aurora Farma', owner: 'Ana Rocha', status: 'aberta', value: 'R$ 184k' },
      { id: 'p-102', title: 'Grupo Valen Atacado', owner: 'Bruno Lima', status: 'aberta', value: 'R$ 132k' }
    ]
  },
  {
    id: 'diagnostico',
    label: 'Diagnóstico',
    amount: 'R$ 1,09M',
    items: [
      { id: 'p-103', title: 'Banco Prisma Sul', owner: 'Carla Mendes', status: 'em-analise', value: 'R$ 208k' },
      { id: 'p-104', title: 'Lojas Equinox', owner: 'Diego Souza', status: 'em-analise', value: 'R$ 96k' }
    ]
  },
  {
    id: 'proposta',
    label: 'Proposta enviada',
    amount: 'R$ 1,42M',
    items: [
      { id: 'p-105', title: 'Atlas Seguros', owner: 'Ana Rocha', status: 'aprovada', value: 'R$ 286k' },
      { id: 'p-106', title: 'Mercado Trento', owner: 'Bruno Lima', status: 'em-analise', value: 'R$ 171k' }
    ]
  },
  {
    id: 'aprovacao',
    label: 'Aprovação financeira',
    amount: 'R$ 670k',
    items: [
      { id: 'p-107', title: 'Urban Mobility Co', owner: 'Carla Mendes', status: 'aprovada', value: 'R$ 143k' },
      { id: 'p-108', title: 'Distrito Foods', owner: 'Diego Souza', status: 'recusada', value: 'R$ 87k' }
    ]
  }
];

export const proposalsRecentRowsV4 = [
  {
    id: 'pr-001',
    cliente: 'Rede Aurora Farma',
    valor: 'R$ 184k',
    status: 'aberta',
    responsavel: 'Ana Rocha',
    regiao: 'Centro Expandido',
    estagio: 'lead',
    updatedAt: '2026-05-18 16:20'
  },
  {
    id: 'pr-002',
    cliente: 'Banco Prisma Sul',
    valor: 'R$ 208k',
    status: 'em-analise',
    responsavel: 'Carla Mendes',
    regiao: 'Sul',
    estagio: 'diagnostico',
    updatedAt: '2026-05-18 15:40'
  },
  {
    id: 'pr-003',
    cliente: 'Atlas Seguros',
    valor: 'R$ 286k',
    status: 'aprovada',
    responsavel: 'Ana Rocha',
    regiao: 'Norte',
    estagio: 'proposta',
    updatedAt: '2026-05-18 14:12'
  },
  {
    id: 'pr-004',
    cliente: 'Distrito Foods',
    valor: 'R$ 87k',
    status: 'recusada',
    responsavel: 'Diego Souza',
    regiao: 'Leste',
    estagio: 'aprovacao',
    updatedAt: '2026-05-18 12:07'
  },
  {
    id: 'pr-005',
    cliente: 'Mercado Trento',
    valor: 'R$ 171k',
    status: 'em-analise',
    responsavel: 'Bruno Lima',
    regiao: 'Oeste',
    estagio: 'proposta',
    updatedAt: '2026-05-18 11:15'
  }
];

export const contractsStatusOptionsV4 = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'renovacao', label: 'Em renovação' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'suspenso', label: 'Suspenso' }
];

export const contractsClientOptionsV4 = [
  { value: 'todos', label: 'Todos os clientes' },
  { value: 'rede-aurora-farma', label: 'Rede Aurora Farma' },
  { value: 'atlas-seguros', label: 'Atlas Seguros' },
  { value: 'banco-prisma-sul', label: 'Banco Prisma Sul' },
  { value: 'urban-mobility-co', label: 'Urban Mobility Co' }
];

export const contractsDueOptionsV4 = [
  { value: 'todos', label: 'Todos os vencimentos' },
  { value: '7d', label: 'Vence em 7 dias' },
  { value: '30d', label: 'Vence em 30 dias' },
  { value: '60d', label: 'Vence em 60 dias' },
  { value: 'vencido', label: 'Já vencido' }
];

export const contractsHeaderV4 = {
  title: 'Contratos v4',
  subtitle: 'Gestão de vigência, renovações e compliance financeiro',
  description: 'Protótipo visual para acompanhar contratos sem alterar ContratosPage real e sem mutações.'
};

export const contractsKpisV4 = [
  { id: 'ativos', label: 'Contratos ativos', value: '286', change: '+17 no mês', trend: 'up' },
  { id: 'renovacao', label: 'Em renovação', value: '34', change: '11 críticos', trend: 'warning' },
  { id: 'vencimento', label: 'Vencem em 30 dias', value: '29', change: '+4 vs semana', trend: 'down' },
  { id: 'assinatura', label: 'Assinaturas pendentes', value: '12', change: '4 com risco alto', trend: 'down' },
  { id: 'pagamento', label: 'Pagamentos em dia', value: '93,6%', change: '+1,0 p.p.', trend: 'up' },
  { id: 'receita', label: 'Receita contratada', value: 'R$ 6,91M', change: 'janela anual', trend: 'up' }
];

export const contractsRowsV4 = [
  {
    id: 'ct-001',
    cliente: 'Rede Aurora Farma',
    regiao: 'Centro Expandido',
    status: 'ativo',
    assinatura: 'assinado',
    pagamento: 'em-dia',
    inicio: '2026-01-01',
    vencimento: '2026-12-31',
    valor: 'R$ 842k'
  },
  {
    id: 'ct-002',
    cliente: 'Atlas Seguros',
    regiao: 'Norte',
    status: 'renovacao',
    assinatura: 'pendente',
    pagamento: 'em-dia',
    inicio: '2025-07-15',
    vencimento: '2026-06-20',
    valor: 'R$ 618k'
  },
  {
    id: 'ct-003',
    cliente: 'Banco Prisma Sul',
    regiao: 'Sul',
    status: 'renovacao',
    assinatura: 'assinado',
    pagamento: 'atrasado',
    inicio: '2025-06-01',
    vencimento: '2026-05-28',
    valor: 'R$ 704k'
  },
  {
    id: 'ct-004',
    cliente: 'Urban Mobility Co',
    regiao: 'Leste',
    status: 'suspenso',
    assinatura: 'pendente',
    pagamento: 'atrasado',
    inicio: '2025-02-12',
    vencimento: '2026-05-10',
    valor: 'R$ 329k'
  },
  {
    id: 'ct-005',
    cliente: 'Mercado Trento',
    regiao: 'Oeste',
    status: 'vencido',
    assinatura: 'assinado',
    pagamento: 'em-dia',
    inicio: '2024-05-01',
    vencimento: '2026-04-30',
    valor: 'R$ 245k'
  }
];

export const contractsDuePanelV4 = [
  { id: 'due-1', cliente: 'Banco Prisma Sul', contrato: 'ct-003', dias: 9, valor: 'R$ 704k', criticidade: 'alta' },
  { id: 'due-2', cliente: 'Atlas Seguros', contrato: 'ct-002', dias: 23, valor: 'R$ 618k', criticidade: 'media' },
  { id: 'due-3', cliente: 'Urban Mobility Co', contrato: 'ct-004', dias: -8, valor: 'R$ 329k', criticidade: 'alta' },
  { id: 'due-4', cliente: 'Rede Aurora Farma', contrato: 'ct-001', dias: 226, valor: 'R$ 842k', criticidade: 'baixa' }
];

export const contractsRenewalAlertsV4 = [
  {
    id: 'al-1',
    title: 'Renovação crítica: Banco Prisma Sul',
    description: 'Contrato ct-003 com risco financeiro devido a atraso de pagamento e janela curta de renovação.',
    level: 'error'
  },
  {
    id: 'al-2',
    title: 'Assinatura pendente: Atlas Seguros',
    description: 'Documento principal aguardando assinatura jurídica para liberar aditivo comercial.',
    level: 'warning'
  },
  {
    id: 'al-3',
    title: 'Contrato suspenso em tratativa',
    description: 'Urban Mobility Co permanece bloqueado até normalização de compliance documental.',
    level: 'info'
  }
];
