/* ═══════════════════════════════════════════════════════════════
   BOARD DETAIL MOCK DATA — Generator deterministico por board.id
   Sem API real, sem dependências externas.
═══════════════════════════════════════════════════════════════ */

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h);
}

function pick(arr, key) { return arr[hash(key) % arr.length]; }

/* ── Lookup tables ──────────────────────────────────────────── */
const CITY_MAP = {
  'São Paulo':         { cidade: 'São Paulo',       uf: 'SP' },
  'Rio de Janeiro':    { cidade: 'Rio de Janeiro',  uf: 'RJ' },
  'Minas Gerais':      { cidade: 'Belo Horizonte',  uf: 'MG' },
  'Rio Grande do Sul': { cidade: 'Porto Alegre',    uf: 'RS' },
  'Paraná':            { cidade: 'Curitiba',        uf: 'PR' },
};

const FORMAT_MAP = {
  'Premium A+':   { formato: 'Outdoor Digital', dimensoes: '9m × 3m', face: 'Frente única', material: 'LED Full Color',          iluminacao: 'LED integrado'         },
  'Premium A':    { formato: 'Outdoor Digital', dimensoes: '9m × 3m', face: 'Dupla face',   material: 'LED Full Color',          iluminacao: 'LED integrado'         },
  'Standard B+':  { formato: 'Outdoor Iluminado', dimensoes: '9m × 3m', face: 'Frente única', material: 'Acrílico retroiluminado', iluminacao: 'Backlit'             },
  'Standard B':   { formato: 'Outdoor Padrão',  dimensoes: '8m × 3m', face: 'Dupla face',   material: 'Lona impressa',           iluminacao: 'Spot externo'          },
  'Econômico C':  { formato: 'Painel Padrão',   dimensoes: '6m × 2m', face: 'Frente única', material: 'Lona impressa',           iluminacao: 'Sem iluminação'        },
};

const ZONES = ['Zona Comercial A', 'Corredor Empresarial', 'Eixo de Alto Fluxo', 'Região Central', 'Eixo Premium', 'Zona Industrial'];
const REFS  = ['Próximo ao Shopping', 'Altura do viaduto', 'Acesso à rodovia', 'Frente à estação de metrô', 'Próximo ao parque', 'Altura do complexo comercial'];
const FLOWS = ['85.000 veíc/dia', '120.000 veíc/dia', '65.000 veíc/dia', '200.000 veíc/dia', '45.000 veíc/dia', '175.000 veíc/dia'];
const DIRS  = ['Sentido Centro', 'Sentido Bairro', 'Sentido Norte', 'Sentido Sul', 'Sentido Leste', 'Mão dupla'];
const CONDS = ['Excelente', 'Boa', 'Regular', 'Boa', 'Excelente', 'Muito boa'];
const OWNERS = ['Carlos Mendes', 'Ana Paula Rocha', 'Fernando Silva', 'Juliana Costa', 'Ricardo Alves'];
const INSPECTIONS = ['2026-05-12', '2026-04-04', '2026-03-18', '2026-03-01', '2026-02-14', '2026-01-28'];

const CLI = [
  'Grupo Fast Moda', 'Meridian Media', 'Transportes ABC', 'Atacado Boa Vista',
  'AutoPeças Central', 'Varejo Sul LTDA', 'Anunciante Nacional X', 'Pharma Brasil',
  'Rede Super X', 'Banco Digital Y', 'Telecom Z', 'Moda Store',
];
const CAMP = [
  'Campanha Verão', 'Lançamento Produto', 'Black Friday', 'Marca Institucional',
  'Promoção Anual', 'Campanha Regional', 'Produto Novo', 'Expansão de Marca',
];
const RESP = ['João Lima', 'Maria Fernanda', 'Pedro Souza', 'Carla Reis', 'Rafael Nunes'];

/* ── Contracts generator ────────────────────────────────────── */
function genContracts(board) {
  const result = [];

  if (board.campanha && board.cliente) {
    result.push({
      id: `CTR-${board.id}-001`,
      cliente: board.cliente,
      campanha: board.campanha,
      inicio: '2026-04-01',
      fim: board.vencimento ?? '2026-07-01',
      valorMensal: board.receitaEstimada,
      status: 'active',
      renovacao: false,
      responsavelComercial: pick(RESP, board.id + 'r0'),
    });
  }

  const bases = [
    ['2026-01-01', '2026-03-31'],
    ['2025-09-01', '2025-12-31'],
    ['2025-05-01', '2025-08-31'],
    ['2025-01-01', '2025-04-30'],
  ];

  bases.slice(0, 4 - result.length).forEach(([ini, fim], i) => {
    const hi = hash(`${board.id}-c${i}`);
    const valor = Math.round(board.receitaEstimada * (0.78 + (hi % 24) / 100));
    result.push({
      id: `CTR-${board.id}-${String(result.length + 1).padStart(3, '0')}`,
      cliente: pick(CLI, `${board.id}-cli${i}`),
      campanha: `${pick(CAMP, `${board.id}-camp${i}`)} ${2025 + (i < 2 ? 1 : 0)}`,
      inicio: ini,
      fim,
      valorMensal: valor,
      status: 'closed',
      renovacao: i === 0,
      responsavelComercial: pick(RESP, `${board.id}-resp${i}`),
    });
  });

  return result;
}

/* ── Activity generator ─────────────────────────────────────── */
const ACT_TYPES = [
  { type: 'campaign_activated', desc: 'Campanha ativada'       },
  { type: 'contract_renewed',   desc: 'Contrato renovado'      },
  { type: 'inspection',         desc: 'Vistoria realizada'     },
  { type: 'board_released',     desc: 'Placa liberada'         },
  { type: 'registry_update',    desc: 'Ajuste cadastral'       },
  { type: 'status_change',      desc: 'Alteração de status'    },
  { type: 'contract_renewed',   desc: 'Proposta confirmada'    },
  { type: 'inspection',         desc: 'Inspeção de campo'      },
];
const ACT_DATES = [
  '2026-05-18', '2026-05-10', '2026-04-28', '2026-04-12',
  '2026-03-25', '2026-03-01', '2026-02-15',
];

function genActivity(board) {
  const h = hash(board.id);
  return Array.from({ length: 7 }, (_, i) => {
    const act = ACT_TYPES[(h + i) % ACT_TYPES.length];
    const desc = i === 0 && board.campanha
      ? `${act.desc}: ${board.campanha}`
      : act.desc;
    return {
      type:        act.type,
      description: desc,
      user:        pick(RESP, `${board.id}-user${i}`),
      date:        ACT_DATES[i % ACT_DATES.length],
    };
  });
}

/* ── Performance generator ──────────────────────────────────── */
function genPerformance(board) {
  const h = hash(board.id);
  const taxa = board.ocupado ? 0.87 + (h % 12) / 100 : 0.38 + (h % 32) / 100;
  const diasOcupada = Math.round(365 * taxa);
  const receitaAcum = Math.round(board.receitaEstimada * 12 * taxa);
  const media = Math.round(board.receitaEstimada * (0.82 + (h % 20) / 100));

  return {
    taxaOcupacao:     Math.round(taxa * 100),
    diasOcupada,
    diasDisponivel:   365 - diasOcupada,
    receitaAcumulada: receitaAcum,
    mediaRegiao:      media,
  };
}

/* ── Main export ────────────────────────────────────────────── */
export function getBoardDetailData(board) {
  const cityData = CITY_MAP[board.regiao] ?? { cidade: board.regiao, uf: board.siglaRegiao };
  const techData = FORMAT_MAP[board.categoria] ?? FORMAT_MAP['Standard B'];

  return {
    geo: {
      lat: board.lat?.toFixed(6) ?? '—',
      lng: board.lng?.toFixed(6) ?? '—',
      endereco: board.localizacao,
      cidade: cityData.cidade,
      uf: cityData.uf,
      regiaoOperacional: board.regiao,
      zona: pick(ZONES, board.id + 'z'),
      pontoReferencia: pick(REFS, board.id + 'ref'),
      fluxoEstimado: pick(FLOWS, board.id + 'fl'),
      visibilidade: board.visibilidade,
      iluminacao: techData.iluminacao,
      sentidoVia: pick(DIRS, board.id + 'dir'),
    },
    tech: {
      categoria: board.categoria,
      formato: techData.formato,
      dimensoes: techData.dimensoes,
      face: techData.face,
      material: techData.material,
      iluminacao: techData.iluminacao,
      ultimaVistoria: pick(INSPECTIONS, board.id + 'vis'),
      condicao: pick(CONDS, board.id + 'cond'),
      responsavelOperacional: pick(OWNERS, board.id + 'own'),
      disponibilidade: board.ocupado ? 'Ocupada' : 'Livre',
      ocupacao: `${Math.round(board.ocupacao * 100)}%`,
    },
    contracts: genContracts(board),
    activity: genActivity(board),
    performance: genPerformance(board),
    recommendations: {
      comercial: board.recomendacao,
      operacional: board.status === 'maintenance' || board.status === 'critical'
        ? 'Acionar equipe técnica para inspeção antes de aceitar novas campanhas.'
        : board.ocupado
          ? 'Acompanhar desempenho e preparar proposta de renovação antecipada.'
          : 'Contatar carteira de leads qualificados para esta região.',
      proximaAcao: board.status === 'available'
        ? 'Enviar proposta para leads qualificados.'
        : board.status === 'reserved'
          ? 'Confirmar renovação de contrato com o cliente.'
          : board.status === 'critical' || board.status === 'maintenance'
            ? 'Resolver pendência técnica como prioridade.'
            : 'Iniciar negociação de renovação nos próximos 7 dias.',
    },
  };
}
