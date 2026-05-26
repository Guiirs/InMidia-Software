/* ═══════════════════════════════════════════════════════════════
   REPORTS MOCK DATA — V4 PAINEL
   Analytics executivos e relatórios de desempenho.
═══════════════════════════════════════════════════════════════ */
import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';

/* ── CARDS DE RELATÓRIOS EXECUTIVOS ──────────────────────────── */
export const REPORT_CARDS = [
  { id:'r-occ',    label:'Relatório de Ocupação',       icone:'donut_large',    periodo:'Maio 2026',  estado:OPERATIONAL_STATE.HEALTHY, ultimaGeracao:'há 2h',    tamanho:'1,2 MB', insights:['78,1% ocupação global','Premium A+ em 91,7%','RS abaixo da meta']                          },
  { id:'r-rev',    label:'Relatório de Receita',        icone:'attach_money',   periodo:'Maio 2026',  estado:OPERATIONAL_STATE.HEALTHY, ultimaGeracao:'há 2h',    tamanho:'0,8 MB', insights:['R$ 284.750 realizados','89,1% da meta anual','Crescimento de 12%']                       },
  { id:'r-reg',    label:'Análise Regional',            icone:'map',            periodo:'Maio 2026',  estado:OPERATIONAL_STATE.WARNING, ultimaGeracao:'há 1h',    tamanho:'2,1 MB', insights:['SP lidera com 84,6%','RS com déficit de 22,5%','MG supera meta em 8%']                   },
  { id:'r-camp',   label:'Campanhas em Veiculação',     icone:'campaign',       periodo:'Maio 2026',  estado:OPERATIONAL_STATE.SYNCING, ultimaGeracao:'processando',tamanho:'—',    insights:['43 campanhas ativas','Ticket médio R$ 4.200','Tempo médio 28 dias']                      },
  { id:'r-cont',   label:'Vencimentos de Contratos',    icone:'event_busy',     periodo:'Mai—Jun 2026',estado:OPERATIONAL_STATE.WARNING,ultimaGeracao:'há 30min', tamanho:'0,4 MB', insights:['11 contratos vencendo','R$ 34.400/mês em risco','3 com renovação confirmada']           },
  { id:'r-perf',   label:'Desempenho Comercial',        icone:'leaderboard',    periodo:'Maio 2026',  estado:OPERATIONAL_STATE.HEALTHY, ultimaGeracao:'há 3h',    tamanho:'1,4 MB', insights:['Carlos Mendes lidera SP','Conversão global 6,3%','Meta de receita em 89,1%']             },
];

/* ── PERFORMANCE ANALYTICS (crescimento mensal) ──────────────── */
export const PERFORMANCE_DATA = [
  { mes:'Jun', receita:198000, ocupacao:0.71, contratos:128, campanhas:38 },
  { mes:'Jul', receita:215000, ocupacao:0.73, contratos:131, campanhas:41 },
  { mes:'Ago', receita:228000, ocupacao:0.74, contratos:135, campanhas:40 },
  { mes:'Set', receita:241000, ocupacao:0.75, contratos:136, campanhas:43 },
  { mes:'Out', receita:256000, ocupacao:0.76, contratos:138, campanhas:44 },
  { mes:'Nov', receita:271000, ocupacao:0.77, contratos:140, campanhas:46 },
  { mes:'Dez', receita:284750, ocupacao:0.78, contratos:143, campanhas:43 },
];

/* ── REVENUE ANALYTICS ───────────────────────────────────────── */
export const REVENUE_ANALYTICS = {
  totalAno:          1693750,
  mediasMensal:      241964,
  maiorMes:          { mes:'Dez', valor:284750 },
  menorMes:          { mes:'Jun', valor:198000 },
  crescimentoTotal:  '+43,8%',
  receitaRecorrente: 248000,
  receitaNova:       36750,
  churnEstimado:     12000,
};

/* ── REGIONAL ANALYTICS ──────────────────────────────────────── */
export const REGIONAL_ANALYTICS = [
  { regiao:'São Paulo',         receita:128400, ocupacao:0.846, crescimento:0.12,  meta:130000, pontos:312, campanhas:18 },
  { regiao:'Rio de Janeiro',    receita:72600,  ocupacao:0.747, crescimento:0.03,  meta:80000,  pontos:198, campanhas:12 },
  { regiao:'Minas Gerais',      receita:43200,  ocupacao:0.710, crescimento:0.18,  meta:40000,  pontos:124, campanhas:7  },
  { regiao:'Paraná',            receita:28400,  ocupacao:0.816, crescimento:0.08,  meta:28000,  pontos:76,  campanhas:4  },
  { regiao:'Rio Grande do Sul', receita:24800,  ocupacao:0.674, crescimento:-0.04, meta:32000,  pontos:89,  campanhas:5  },
  { regiao:'Outras',            receita:15800,  ocupacao:0.813, crescimento:0.06,  meta:15000,  pontos:48,  campanhas:3  },
];

/* ── OCCUPANCY ANALYTICS (histórico 7 meses) ─────────────────── */
export const OCCUPANCY_ANALYTICS = {
  historico: [
    { mes:'Jun', global:0.710, premiumA:0.840, standardB:0.690, economico:0.590 },
    { mes:'Jul', global:0.728, premiumA:0.852, standardB:0.708, economico:0.611 },
    { mes:'Ago', global:0.742, premiumA:0.860, standardB:0.724, economico:0.625 },
    { mes:'Set', global:0.751, premiumA:0.865, standardB:0.730, economico:0.640 },
    { mes:'Out', global:0.762, premiumA:0.872, standardB:0.742, economico:0.649 },
    { mes:'Nov', global:0.773, premiumA:0.880, standardB:0.752, economico:0.657 },
    { mes:'Dez', global:0.781, premiumA:0.891, standardB:0.758, economico:0.661 },
  ],
  sazonalidade: [
    { mes:'Jan', fator:0.88, nota:'Pós-festas — retração' },
    { mes:'Feb', fator:0.92, nota:'Retomada gradual' },
    { mes:'Mar', fator:0.96, nota:'Crescimento' },
    { mes:'Abr', fator:0.98, nota:'Estável' },
    { mes:'Mai', fator:1.00, nota:'Pico operacional' },
    { mes:'Jun', fator:0.97, nota:'Início de inverno' },
    { mes:'Jul', fator:0.94, nota:'Férias — leve queda' },
    { mes:'Ago', fator:0.96, nota:'Retomada' },
    { mes:'Set', fator:0.99, nota:'Alta' },
    { mes:'Out', fator:1.02, nota:'Pré-festas' },
    { mes:'Nov', fator:1.04, nota:'Black Friday' },
    { mes:'Dez', fator:1.06, nota:'Natal — pico' },
  ],
};

/* ── EXPORT CENTER ───────────────────────────────────────────── */
export const EXPORT_FORMATS = [
  { id:'pdf-exec',  tipo:'PDF',  label:'Relatório Executivo',     descricao:'Resumo gerencial completo com todos os indicadores', icone:'picture_as_pdf', cor:'var(--v4p-danger)'   },
  { id:'pdf-occ',   tipo:'PDF',  label:'Relatório de Ocupação',   descricao:'Detalhamento por região e categoria de inventário',  icone:'picture_as_pdf', cor:'var(--v4p-danger)'   },
  { id:'xlsx-data', tipo:'XLSX', label:'Dados Completos',         descricao:'Planilha com todos os pontos, contratos e receita',  icone:'table_chart',    cor:'var(--v4p-success)'  },
  { id:'xlsx-cont', tipo:'XLSX', label:'Carteira de Contratos',   descricao:'Lista completa com vencimentos e status',            icone:'table_chart',    cor:'var(--v4p-success)'  },
  { id:'csv-inv',   tipo:'CSV',  label:'Inventário Completo',     descricao:'Export de todas as placas com coordenadas e status', icone:'data_object',    cor:'var(--v4p-accent)'   },
  { id:'csv-camp',  tipo:'CSV',  label:'Campanhas Ativas',        descricao:'Campanhas em veiculação com detalhes operacionais',  icone:'data_object',    cor:'var(--v4p-accent)'   },
];
