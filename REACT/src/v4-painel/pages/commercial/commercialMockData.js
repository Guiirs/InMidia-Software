/* ═══════════════════════════════════════════════════════════════
   COMMERCIAL MOCK DATA — V4 PAINEL
   Inteligência comercial enterprise para mídia OOH.
═══════════════════════════════════════════════════════════════ */
import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { PRIORITY }          from '../../foundation/priorities.js';
import { SEVERITY }          from '../../foundation/severityLevels.js';

/* ── PIPELINE EXECUTIVO ──────────────────────────────────────── */
export const PIPELINE_STAGES = [
  { id:'leads',       label:'Leads',              count:284, valor:null,        receita:null,     conversao:null, cor:'var(--v4p-accent)',      bgOpacity:'0.15' },
  { id:'propostas',   label:'Propostas enviadas', count:128, valor:'R$ 512.000',receita:512000,   conversao:0.45, cor:'var(--v4p-info)',         bgOpacity:'0.14' },
  { id:'negociacao',  label:'Em negociação',      count: 67, valor:'R$ 268.000',receita:268000,   conversao:0.52, cor:'var(--v4p-intelligence)', bgOpacity:'0.14' },
  { id:'fechamento',  label:'Fechamento ativo',   count: 31, valor:'R$ 124.000',receita:124000,   conversao:0.46, cor:'var(--v4p-warning)',      bgOpacity:'0.13' },
  { id:'fechados',    label:'Contratos fechados', count: 18, valor:'R$ 72.000', receita:72000,    conversao:0.58, cor:'var(--v4p-success)',      bgOpacity:'0.12' },
];

export const PIPELINE_SUMMARY = {
  taxaConversaoGlobal: 0.063,
  ticketMedioFechado:  4000,
  cicloMedioVendas:    28,
  receitaNoMes:        72000,
  metaMensal:          90000,
  percentMeta:         0.80,
  crescimentoMoM:      0.12,
};

/* ── OPPORTUNITY BOARD ───────────────────────────────────────── */
export const OPPORTUNITIES = [
  { id:'opp-001', cliente:'Grupo Azul Publicidade',     regiao:'São Paulo',         potencial:18400, potencialFmt:'R$ 18.400/mês', prioridade:PRIORITY.URGENT, status:'Fechamento', chance:0.88, tags:['renovação','premium'],  recomendacao:'Reunião de renovação esta semana.',          estado:OPERATIONAL_STATE.CRITICAL  },
  { id:'opp-002', cliente:'Meridian Media',             regiao:'Minas Gerais',      potencial:8700,  potencialFmt:'R$ 8.700/mês',  prioridade:PRIORITY.HIGH,   status:'Negociação', chance:0.65, tags:['expansão','MG'],         recomendacao:'Proposta de expansão no corredor BH-Betim.',   estado:OPERATIONAL_STATE.WARNING   },
  { id:'opp-003', cliente:'Distribuidora FastFood',     regiao:'Rio de Janeiro',    potencial:9200,  potencialFmt:'R$ 9.200/mês',  prioridade:PRIORITY.HIGH,   status:'Proposta',   chance:0.55, tags:['nacional','renovação'],  recomendacao:'Oferecer bundle SP+RJ com desconto.',          estado:OPERATIONAL_STATE.WARNING   },
  { id:'opp-004', cliente:'Atacado Sul LTDA',           regiao:'Paraná',            potencial:4800,  potencialFmt:'R$ 4.800/mês',  prioridade:PRIORITY.NORMAL, status:'Negociação', chance:0.70, tags:['expansão','corredor'],   recomendacao:'Adicionar posição BR-376 km 91.',             estado:OPERATIONAL_STATE.HEALTHY   },
  { id:'opp-005', cliente:'Rede Farmácias Vitalis',     regiao:'Rio Grande do Sul', potencial:6200,  potencialFmt:'R$ 6.200/mês',  prioridade:PRIORITY.HIGH,   status:'Proposta',   chance:0.42, tags:['saúde','regional'],      recomendacao:'Oferecer posição Freeway + Ipiranga como kit.',estado:OPERATIONAL_STATE.WARNING   },
  { id:'opp-006', cliente:'Construtora Horizonte',      regiao:'Minas Gerais',      potencial:5500,  potencialFmt:'R$ 5.500/mês',  prioridade:PRIORITY.NORMAL, status:'Lead',       chance:0.30, tags:['imóveis','BH'],          recomendacao:'Qualificar lead e apresentar portfólio BH.',  estado:OPERATIONAL_STATE.HEALTHY   },
  { id:'opp-007', cliente:'Supermercado Nação',         regiao:'São Paulo',         potencial:7400,  potencialFmt:'R$ 7.400/mês',  prioridade:PRIORITY.HIGH,   status:'Fechamento', chance:0.82, tags:['alimentação','SP'],       recomendacao:'Finalizar contrato até sexta.',               estado:OPERATIONAL_STATE.WARNING   },
  { id:'opp-008', cliente:'Agência Criative',           regiao:'Rio de Janeiro',    potencial:3800,  potencialFmt:'R$ 3.800/mês',  prioridade:PRIORITY.NORMAL, status:'Lead',       chance:0.25, tags:['agência','barra'],        recomendacao:'Enviar proposta para Barra da Tijuca.',       estado:OPERATIONAL_STATE.HEALTHY   },
  { id:'opp-009', cliente:'Logística Rota Sul',         regiao:'Rio Grande do Sul', potencial:4100,  potencialFmt:'R$ 4.100/mês',  prioridade:PRIORITY.HIGH,   status:'Proposta',   chance:0.48, tags:['logística','RS'],         recomendacao:'Focar no corredor Freeway — alto tráfego.',   estado:OPERATIONAL_STATE.WARNING   },
  { id:'opp-010', cliente:'Fintech Capital',            regiao:'São Paulo',         potencial:12000, potencialFmt:'R$ 12.000/mês', prioridade:PRIORITY.HIGH,   status:'Negociação', chance:0.60, tags:['fintech','premium'],      recomendacao:'Propor combo Paulista + Marginal Tietê.',      estado:OPERATIONAL_STATE.WARNING   },
];

/* ── REVENUE FORECAST ────────────────────────────────────────── */
export const REVENUE_FORECAST = {
  metaAnual:      1800000,
  realizadoAnual: 1283000,
  projetadoAnual: 1650000,
  percentMeta:    0.917,
  receitaRecorrente: 248000,
  crescimentoMoM: 0.082,
  trimestres: [
    { label:'T2 2025', realizado:428000, meta:450000, projetado:null },
    { label:'T3 2025', realizado:498000, meta:480000, projetado:null },
    { label:'T4 2025', realizado:357000, meta:420000, projetado:null },
    { label:'T1 2026', realizado:null,   meta:420000, projetado:410000 },
    { label:'T2 2026', realizado:null,   meta:450000, projetado:440000 },
  ],
  meses: [
    { label:'Jun', valor:198000, projetado:false, meta:210000 },
    { label:'Jul', valor:215000, projetado:false, meta:220000 },
    { label:'Ago', valor:228000, projetado:false, meta:230000 },
    { label:'Set', valor:241000, projetado:false, meta:240000 },
    { label:'Out', valor:256000, projetado:false, meta:250000 },
    { label:'Nov', valor:271000, projetado:false, meta:260000 },
    { label:'Dez', valor:284750, projetado:false, meta:270000 },
    { label:'Jan', valor:298000, projetado:true,  meta:280000 },
    { label:'Fev', valor:305000, projetado:true,  meta:290000 },
    { label:'Mar', valor:312000, projetado:true,  meta:300000 },
    { label:'Abr', valor:318000, projetado:true,  meta:310000 },
    { label:'Mai', valor:325000, projetado:true,  meta:320000 },
  ],
};

/* ── COMMERCIAL PERFORMANCE ──────────────────────────────────── */
export const REGIONAL_PERFORMANCE = [
  { id:'sp', regiao:'São Paulo',        receita:128400, meta:130000, percent:0.988, ocupacaoGerada:0.846, crescimento:'+12%', rank:1, tendencia:'alta',    responsavel:'Carlos Mendes'  },
  { id:'rj', regiao:'Rio de Janeiro',   receita:72600,  meta:80000,  percent:0.908, ocupacaoGerada:0.747, crescimento:'+3%',  rank:2, tendencia:'estável', responsavel:'Ana Paula'      },
  { id:'mg', regiao:'Minas Gerais',     receita:43200,  meta:40000,  percent:1.080, ocupacaoGerada:0.710, crescimento:'+18%', rank:3, tendencia:'alta',    responsavel:'Rodrigo Lima'   },
  { id:'pr', regiao:'Paraná',           receita:28400,  meta:28000,  percent:1.014, ocupacaoGerada:0.816, crescimento:'+8%',  rank:4, tendencia:'alta',    responsavel:'Fernanda Souza' },
  { id:'rs', regiao:'Rio Grande do Sul',receita:24800,  meta:32000,  percent:0.775, ocupacaoGerada:0.674, crescimento:'-4%',  rank:5, tendencia:'queda',   responsavel:'Marcos Viana'  },
];

export const SELLERS_PERFORMANCE = [
  { nome:'Carlos Mendes',   regiao:'SP', contratos:42, receita:128400, meta:130000, percent:0.988, conversao:0.24, rank:1 },
  { nome:'Ana Paula',       regiao:'RJ', contratos:31, receita:72600,  meta:80000,  percent:0.908, conversao:0.21, rank:2 },
  { nome:'Rodrigo Lima',    regiao:'MG', contratos:24, receita:43200,  meta:40000,  percent:1.080, conversao:0.28, rank:3 },
  { nome:'Fernanda Souza',  regiao:'PR', contratos:19, receita:28400,  meta:28000,  percent:1.014, conversao:0.22, rank:4 },
  { nome:'Marcos Viana',    regiao:'RS', contratos:14, receita:24800,  meta:32000,  percent:0.775, conversao:0.17, rank:5 },
];

/* ── COMMERCIAL INSIGHTS ─────────────────────────────────────── */
export const COMMERCIAL_INSIGHTS = [
  { id:'ci-1', tipo:'urgente',    icone:'crisis_alert',   titulo:'3 contratos vencem em menos de 10 dias',          descricao:'Receita combinada de R$ 34.400/mês em risco direto. Prioridade máxima de renovação.',  impacto:'R$ 412.800/ano', cor:'var(--v4p-danger)'       },
  { id:'ci-2', tipo:'expansão',   icone:'trending_up',    titulo:'MG supera meta em 8% — potencial de expansão',    descricao:'Rodrigo Lima lidera crescimento. Proposta de expansão no corredor BH-Betim pode adicionar R$ 8.700/mês.', impacto:'+R$ 104.400/ano', cor:'var(--v4p-success)'    },
  { id:'ci-3', tipo:'ativação',   icone:'location_on',    titulo:'SP-1089 ocioso há 12 dias — corredor premium',    descricao:'Posição Marginal Tietê com potencial de R$ 5.800/mês. Pipeline já possui leads qualificados.', impacto:'R$ 69.600/ano', cor:'var(--v4p-warning)'   },
  { id:'ci-4', tipo:'regional',   icone:'map',            titulo:'RS abaixo da meta em 22,5% — ação necessária',    descricao:'Marco Viana com pipeline insuficiente para cobrir o déficit. Campanha de ativação regional recomendada.', impacto:'-R$ 7.200/mês', cor:'var(--v4p-danger)'  },
  { id:'ci-5', tipo:'estratégico',icone:'auto_awesome',   titulo:'Bundle SP+RJ pode fechar FastFood em 5 dias',     descricao:'Distribuidora FastFood analisa proposta separada. Oferta combinada com desconto de 8% tem alta chance de fechamento.', impacto:'R$ 9.200/mês', cor:'var(--v4p-intelligence)' },
  { id:'ci-6', tipo:'crescimento',icone:'insights',       titulo:'Receita recorrente cresceu 8,2% MoM',             descricao:'Base de contratos saudável. Foco em renovações pode sustentar crescimento acima de 10% até Q2 2026.', impacto:'+R$ 21.000/mês', cor:'var(--v4p-accent)' },
];

export const SALES_TARGETS = {
  metaMensal:    90000,
  realizado:     72000,
  percentual:    0.800,
  faltaParaMeta: 18000,
  diasRestantes: 12,
  projecaoFinal: 88000,
};
