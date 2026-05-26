const actionLabels = ['Detalhes', 'Historico', 'Agenda'];

export const boardStatusListV4 = [
  'disponivel',
  'ocupada',
  'reservada',
  'manutencao',
  'indisponivel',
  'vencendo',
  'pendente'
];

export const boardsMockDataV4 = [
  {
    id: 'board-001',
    code: 'OOH-001-A',
    name: 'Placa Central Norte',
    location: 'Avenida Central, 1204',
    city: 'Sao Paulo',
    region: 'Centro',
    status: 'disponivel',
    occupancy: 22,
    availabilityLabel: 'Janela de comercializacao aberta',
    currentClient: '',
    periodLabel: '',
    referencePrice: 18500,
    actionLabels,
    photoUrl: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'board-002',
    code: 'OOH-014-C',
    name: 'Placa Eixo Leste',
    location: 'Avenida dos Estados, 928',
    city: 'Sao Paulo',
    region: 'Leste',
    status: 'ocupada',
    occupancy: 88,
    availabilityLabel: 'Alta ocupacao no ciclo atual',
    currentClient: 'Auto Via Express',
    periodLabel: 'Contrato 02/05/2026 - 30/06/2026',
    referencePrice: 23600,
    actionLabels,
    photoUrl: 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'board-003',
    code: 'OOH-021-R',
    name: 'Placa Polo Sul',
    location: 'Marginal Sul, 2440',
    city: 'Sao Paulo',
    region: 'Sul',
    status: 'reservada',
    occupancy: 76,
    availabilityLabel: 'Reserva confirmada para proximo bloco',
    currentClient: 'Rede Farma Prime',
    periodLabel: 'Reserva 01/07/2026 - 31/07/2026',
    referencePrice: 20900,
    actionLabels,
    photoUrl: 'https://images.unsplash.com/photo-1462392246754-28dfa2df8e6b?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'board-004',
    code: 'OOH-033-M',
    name: 'Placa Norte Industrial',
    location: 'Rua das Fabricas, 88',
    city: 'Guarulhos',
    region: 'Norte',
    status: 'manutencao',
    occupancy: 0,
    availabilityLabel: 'Parada para manutencao preventiva',
    currentClient: '',
    periodLabel: 'Retorno previsto em 3 dias',
    referencePrice: 15800,
    actionLabels,
    photoUrl: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'board-005',
    code: 'OOH-045-I',
    name: 'Placa Avenida Oeste',
    location: 'Avenida Republica, 411',
    city: 'Osasco',
    region: 'Oeste',
    status: 'indisponivel',
    occupancy: 100,
    availabilityLabel: 'Bloqueada por contingencia operacional',
    currentClient: 'Sem uso comercial',
    periodLabel: 'Aguardando liberacao de compliance',
    referencePrice: 17200,
    actionLabels,
    photoUrl: 'https://images.unsplash.com/photo-1508736793122-f516e3ba5569?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'board-006',
    code: 'OOH-052-V',
    name: 'Placa Centro Expandido',
    location: 'Rua da Consolacao, 1400',
    city: 'Sao Paulo',
    region: 'Centro',
    status: 'vencendo',
    occupancy: 69,
    availabilityLabel: 'Renovacao recomendada nas proximas 72 horas',
    currentClient: 'Instituto Horizonte',
    periodLabel: 'Contrato encerra em 22/05/2026',
    referencePrice: 22400,
    actionLabels,
    photoUrl: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'board-007',
    code: 'OOH-060-P',
    name: 'Placa Corredor ABC',
    location: 'Avenida Industrial, 622',
    city: 'Santo Andre',
    region: 'ABC',
    status: 'pendente',
    occupancy: 41,
    availabilityLabel: 'Pendencia documental antes da ativacao',
    currentClient: 'Mundo Varejo',
    periodLabel: 'Inicio previsto 01/06/2026',
    referencePrice: 19600,
    actionLabels,
    photoUrl: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80'
  }
];

export const boardPreviewStatesV4 = [
  { value: 'default', label: 'Exibicao padrao' },
  { value: 'loading', label: 'Carregando cards' },
  { value: 'empty', label: 'Sem resultados' },
  { value: 'error', label: 'Falha de leitura' }
];
