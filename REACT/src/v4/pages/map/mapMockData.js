const mapStateOptionsV4 = [
  { value: 'default', label: 'Exibição padrão' },
  { value: 'loading', label: 'Carregando' },
  { value: 'empty', label: 'Sem dados' },
  { value: 'error', label: 'Com falha' }
];

const mapRegionOptionsV4 = [
  { value: 'todas', label: 'Todas as regiões' },
  { value: 'centro-expandido', label: 'Centro Expandido' },
  { value: 'norte', label: 'Norte' },
  { value: 'sul', label: 'Sul' },
  { value: 'leste', label: 'Leste' },
  { value: 'oeste', label: 'Oeste' }
];

const mapCityOptionsV4 = [
  { value: 'todas', label: 'Todas as cidades' },
  { value: 'sao-paulo', label: 'São Paulo' },
  { value: 'osasco', label: 'Osasco' },
  { value: 'guarulhos', label: 'Guarulhos' },
  { value: 'santo-andre', label: 'Santo André' }
];

const mapStatusOptionsV4 = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'disponivel', label: 'Disponível' },
  { value: 'ocupada', label: 'Ocupada' },
  { value: 'reservada', label: 'Reservada' },
  { value: 'manutencao', label: 'Manutencao' }
];

const mapAvailabilityOptionsV4 = [
  { value: 'todos', label: 'Todas as faixas' },
  { value: 'alta', label: 'Alta disponibilidade' },
  { value: 'media', label: 'Média disponibilidade' },
  { value: 'baixa', label: 'Baixa disponibilidade' }
];

const mapDensityOptionsV4 = [
  { value: 'executiva', label: 'Executiva' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'cluster', label: 'Cluster' }
];

function buildThumb(label, colorA, colorB) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='520' height='320' viewBox='0 0 520 320'>
    <defs>
      <linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
        <stop offset='0%' stop-color='${colorA}' />
        <stop offset='100%' stop-color='${colorB}' />
      </linearGradient>
    </defs>
    <rect width='520' height='320' fill='url(#g)' />
    <rect x='24' y='24' width='472' height='272' rx='16' fill='rgba(11,16,24,0.28)' stroke='rgba(226,232,240,0.22)' />
    <text x='40' y='284' font-family='Segoe UI' font-size='22' fill='rgba(248,250,252,0.94)'>${label}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const mapAssetsV4 = [
  {
    id: 'map-001',
    name: 'Painel Paulista Norte',
    code: 'SP-PAU-011',
    location: 'Av. Paulista, 1220',
    city: 'São Paulo',
    cityId: 'sao-paulo',
    region: 'Centro Expandido',
    regionId: 'centro-expandido',
    status: 'ocupada',
    availability: 'baixa',
    occupancy: 94,
    clientName: 'Banco Prisma',
    periodLabel: 'Mai 2026 a Jul 2026',
    referencePrice: 48500,
    audience: '122 mil impactos/semana',
    flow: 'alto',
    lat: -23.5614,
    lng: -46.6558,
    x: 56,
    y: 42,
    clusterId: 'cluster-centro-a',
    photoUrl: buildThumb('Paulista Norte', '#0f766e', '#0f172a'),
    actionLabels: ['Ver ativo', 'Abrir dossie']
  },
  {
    id: 'map-002',
    name: 'Toten Marginal Oeste',
    code: 'SP-MAR-034',
    location: 'Marginal Pinheiros, 4900',
    city: 'São Paulo',
    cityId: 'sao-paulo',
    region: 'Oeste',
    regionId: 'oeste',
    status: 'disponivel',
    availability: 'alta',
    occupancy: 27,
    clientName: 'Sem cliente ativo',
    periodLabel: 'Janela aberta para negociação',
    referencePrice: 31800,
    audience: '88 mil impactos/semana',
    flow: 'medio',
    lat: -23.604,
    lng: -46.706,
    x: 34,
    y: 58,
    clusterId: 'cluster-oeste-a',
    photoUrl: buildThumb('Marginal Oeste', '#2563eb', '#111827'),
    actionLabels: ['Simular oferta', 'Ver ativo']
  },
  {
    id: 'map-003',
    name: 'Frontlight Linha Norte',
    code: 'GRU-LN-017',
    location: 'Rod. Fernão Dias, km 84',
    city: 'Guarulhos',
    cityId: 'guarulhos',
    region: 'Norte',
    regionId: 'norte',
    status: 'reservada',
    availability: 'media',
    occupancy: 68,
    clientName: 'Atlas Telecom',
    periodLabel: 'Jun 2026 a Ago 2026',
    referencePrice: 27600,
    audience: '73 mil impactos/semana',
    flow: 'alto',
    lat: -23.4398,
    lng: -46.503,
    x: 63,
    y: 20,
    clusterId: 'cluster-norte-a',
    photoUrl: buildThumb('Linha Norte', '#9333ea', '#1e1b4b'),
    actionLabels: ['Ver reserva', 'Abrir dossie']
  },
  {
    id: 'map-004',
    name: 'Painel Avenida dos Estados',
    code: 'SA-EST-009',
    location: 'Av. dos Estados, 2100',
    city: 'Santo André',
    cityId: 'santo-andre',
    region: 'Sul',
    regionId: 'sul',
    status: 'manutencao',
    availability: 'baixa',
    occupancy: 11,
    clientName: 'Sem cliente ativo',
    periodLabel: 'Bloqueado para manutencao preventiva',
    referencePrice: 19400,
    audience: '49 mil impactos/semana',
    flow: 'medio',
    lat: -23.6531,
    lng: -46.5313,
    x: 66,
    y: 76,
    clusterId: 'cluster-sul-a',
    photoUrl: buildThumb('Avenida dos Estados', '#f97316', '#3f1d10'),
    actionLabels: ['Ver chamado', 'Agendar retorno']
  },
  {
    id: 'map-005',
    name: 'Empena Corredor Castelo',
    code: 'OSA-CST-022',
    location: 'Rod. Castello Branco, km 19',
    city: 'Osasco',
    cityId: 'osasco',
    region: 'Oeste',
    regionId: 'oeste',
    status: 'ocupada',
    availability: 'media',
    occupancy: 81,
    clientName: 'Grupo Orion',
    periodLabel: 'Abr 2026 a Set 2026',
    referencePrice: 36200,
    audience: '97 mil impactos/semana',
    flow: 'alto',
    lat: -23.5268,
    lng: -46.7744,
    x: 21,
    y: 46,
    clusterId: 'cluster-oeste-a',
    photoUrl: buildThumb('Corredor Castelo', '#14b8a6', '#083344'),
    actionLabels: ['Ver ativo', 'Simular extensao']
  },
  {
    id: 'map-006',
    name: 'Painel Dutra Leste',
    code: 'SP-DUT-015',
    location: 'Rod. Presidente Dutra, km 224',
    city: 'São Paulo',
    cityId: 'sao-paulo',
    region: 'Leste',
    regionId: 'leste',
    status: 'disponivel',
    availability: 'alta',
    occupancy: 33,
    clientName: 'Sem cliente ativo',
    periodLabel: 'Janela comercial imediata',
    referencePrice: 24100,
    audience: '64 mil impactos/semana',
    flow: 'alto',
    lat: -23.5141,
    lng: -46.4721,
    x: 79,
    y: 46,
    clusterId: 'cluster-leste-a',
    photoUrl: buildThumb('Dutra Leste', '#0ea5e9', '#082f49'),
    actionLabels: ['Abrir proposta', 'Ver ativo']
  }
];

const mapClustersV4 = [
  {
    id: 'cluster-centro-a',
    label: 'Centro premium',
    x: 53,
    y: 40,
    regionId: 'centro-expandido',
    cityId: 'sao-paulo'
  },
  {
    id: 'cluster-oeste-a',
    label: 'Corredor oeste',
    x: 27,
    y: 52,
    regionId: 'oeste',
    cityId: 'osasco'
  },
  {
    id: 'cluster-norte-a',
    label: 'Anel norte',
    x: 62,
    y: 17,
    regionId: 'norte',
    cityId: 'guarulhos'
  },
  {
    id: 'cluster-leste-a',
    label: 'Eixo leste',
    x: 78,
    y: 47,
    regionId: 'leste',
    cityId: 'sao-paulo'
  },
  {
    id: 'cluster-sul-a',
    label: 'Faixa sul',
    x: 66,
    y: 74,
    regionId: 'sul',
    cityId: 'santo-andre'
  }
];

const mapRegionSummaryV4 = [
  {
    id: 'reg-centro',
    scope: 'Centro Expandido',
    assets: 18,
    occupancy: '86%',
    averageTicket: 'R$ 39,4k',
    health: 'stable'
  },
  {
    id: 'reg-oeste',
    scope: 'Oeste',
    assets: 14,
    occupancy: '72%',
    averageTicket: 'R$ 33,8k',
    health: 'watch'
  },
  {
    id: 'reg-norte',
    scope: 'Norte',
    assets: 11,
    occupancy: '78%',
    averageTicket: 'R$ 30,2k',
    health: 'stable'
  },
  {
    id: 'reg-leste',
    scope: 'Leste',
    assets: 9,
    occupancy: '65%',
    averageTicket: 'R$ 27,1k',
    health: 'attention'
  },
  {
    id: 'reg-sul',
    scope: 'Sul',
    assets: 12,
    occupancy: '70%',
    averageTicket: 'R$ 28,9k',
    health: 'watch'
  }
];

const mapCitySummaryV4 = [
  {
    id: 'city-sp',
    scope: 'São Paulo',
    assets: 31,
    occupancy: '79%',
    averageTicket: 'R$ 36,0k',
    health: 'stable'
  },
  {
    id: 'city-osa',
    scope: 'Osasco',
    assets: 8,
    occupancy: '68%',
    averageTicket: 'R$ 31,7k',
    health: 'watch'
  },
  {
    id: 'city-gru',
    scope: 'Guarulhos',
    assets: 7,
    occupancy: '74%',
    averageTicket: 'R$ 29,5k',
    health: 'stable'
  },
  {
    id: 'city-sa',
    scope: 'Santo André',
    assets: 6,
    occupancy: '61%',
    averageTicket: 'R$ 25,9k',
    health: 'attention'
  }
];

const mapKpisV4 = [
  {
    id: 'coverage',
    label: 'Cobertura georreferenciada',
    value: '94,8%',
    change: '+1,6 p.p. no ciclo',
    trend: 'up'
  },
  {
    id: 'density',
    label: 'Densidade de clusters',
    value: '42 clusters',
    change: '8 zonas premium',
    trend: 'up'
  },
  {
    id: 'ready',
    label: 'Ativos comercializáveis',
    value: '63',
    change: 'janela imediata',
    trend: 'neutral'
  },
  {
    id: 'maintenance',
    label: 'Pontos em manutenção',
    value: '7',
    change: '2 acima do alvo',
    trend: 'down'
  }
];

const mapHeaderV4 = {
  title: 'Mapa de Cobertura v4',
  subtitle: 'Visual geográfico premium para operação OOH',
  description: 'Superfície isolada para validar densidade, clusters e leitura executiva por território sem conexão com mapa real.'
};

export {
  mapAssetsV4,
  mapAvailabilityOptionsV4,
  mapCityOptionsV4,
  mapCitySummaryV4,
  mapClustersV4,
  mapDensityOptionsV4,
  mapHeaderV4,
  mapKpisV4,
  mapRegionOptionsV4,
  mapRegionSummaryV4,
  mapStateOptionsV4,
  mapStatusOptionsV4
};
