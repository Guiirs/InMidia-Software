/* ═══════════════════════════════════════════════════════════════
   CONTRACTS MOCK DATA — V4 PAINEL
   Gestão enterprise de contratos OOH.
═══════════════════════════════════════════════════════════════ */
import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { PRIORITY }          from '../../foundation/priorities.js';
import { SEVERITY }          from '../../foundation/severityLevels.js';

export const CONTRACT_STATUS = {
  ACTIVE:   'active',
  EXPIRING: 'expiring',
  RENEWED:  'renewed',
  PAUSED:   'paused',
  EXPIRED:  'expired',
  DRAFT:    'draft',
};

export const CONTRACTS = [
  { id:'CTR-2847', cliente:'Grupo Azul Publicidade',     regiao:'São Paulo',         placas:3, inicioVigencia:'2024-02-01', vencimento:'2026-05-26', diasRestantes:7,  receita:18400, receitaFmt:'R$ 18.400/mês', status:CONTRACT_STATUS.EXPIRING, risco:SEVERITY.CRITICAL, estado:OPERATIONAL_STATE.CRITICAL,  probabilidadeRenovacao:0.88, acaoRecomendada:'Reunião urgente de renovação', impactoAnual:220800  },
  { id:'CTR-2901', cliente:'Distribuidora FastFood',     regiao:'Rio de Janeiro',    placas:2, inicioVigencia:'2024-06-01', vencimento:'2026-06-03', diasRestantes:15, receita:9200,  receitaFmt:'R$ 9.200/mês',  status:CONTRACT_STATUS.EXPIRING, risco:SEVERITY.HIGH,     estado:OPERATIONAL_STATE.WARNING,  probabilidadeRenovacao:0.65, acaoRecomendada:'Proposta de expansão SP+RJ',   impactoAnual:110400  },
  { id:'CTR-2712', cliente:'Agência Meridian Media',     regiao:'Minas Gerais',      placas:2, inicioVigencia:'2023-12-01', vencimento:'2026-06-12', diasRestantes:24, receita:6800,  receitaFmt:'R$ 6.800/mês',  status:CONTRACT_STATUS.EXPIRING, risco:SEVERITY.MEDIUM,   estado:OPERATIONAL_STATE.WARNING,  probabilidadeRenovacao:0.78, acaoRecomendada:'Revisão de campanha + proposta', impactoAnual:81600   },
  { id:'CTR-2650', cliente:'Atacado Boa Vista',          regiao:'Paraná',            placas:1, inicioVigencia:'2025-02-01', vencimento:'2026-08-01', diasRestantes:74, receita:2400,  receitaFmt:'R$ 2.400/mês',  status:CONTRACT_STATUS.ACTIVE,   risco:SEVERITY.LOW,      estado:OPERATIONAL_STATE.HEALTHY,  probabilidadeRenovacao:0.90, acaoRecomendada:'Iniciar renovação em 45 dias',  impactoAnual:28800   },
  { id:'CTR-2538', cliente:'Transportes ABC',            regiao:'Minas Gerais',      placas:1, inicioVigencia:'2025-01-15', vencimento:'2026-07-15', diasRestantes:57, receita:2800,  receitaFmt:'R$ 2.800/mês',  status:CONTRACT_STATUS.ACTIVE,   risco:SEVERITY.LOW,      estado:OPERATIONAL_STATE.HEALTHY,  probabilidadeRenovacao:0.85, acaoRecomendada:'Monitorar — performance ok',    impactoAnual:33600   },
  { id:'CTR-2421', cliente:'Grupo Fast Moda',            regiao:'São Paulo',         placas:2, inicioVigencia:'2025-03-01', vencimento:'2026-08-28', diasRestantes:101,receita:5200,  receitaFmt:'R$ 5.200/mês',  status:CONTRACT_STATUS.ACTIVE,   risco:SEVERITY.INFO,     estado:OPERATIONAL_STATE.HEALTHY,  probabilidadeRenovacao:0.92, acaoRecomendada:'Avaliar expansão Marginal',     impactoAnual:62400   },
  { id:'CTR-2310', cliente:'Pharma Brasil',              regiao:'São Paulo',         placas:1, inicioVigencia:'2024-11-01', vencimento:'2026-10-31', diasRestantes:165,receita:3600,  receitaFmt:'R$ 3.600/mês',  status:CONTRACT_STATUS.ACTIVE,   risco:SEVERITY.INFO,     estado:OPERATIONAL_STATE.HEALTHY,  probabilidadeRenovacao:0.88, acaoRecomendada:'Alta satisfação — manter',     impactoAnual:43200   },
  { id:'CTR-2108', cliente:'AutoPeças Central',          regiao:'São Paulo',         placas:1, inicioVigencia:'2025-04-01', vencimento:'2026-08-31', diasRestantes:104,receita:2700,  receitaFmt:'R$ 2.700/mês',  status:CONTRACT_STATUS.ACTIVE,   risco:SEVERITY.INFO,     estado:OPERATIONAL_STATE.HEALTHY,  probabilidadeRenovacao:0.82, acaoRecomendada:'Renovação em 75 dias',          impactoAnual:32400   },
  { id:'CTR-2002', cliente:'Anunciante Nacional X',      regiao:'Rio de Janeiro',    placas:1, inicioVigencia:'2025-04-15', vencimento:'2026-06-07', diasRestantes:19, receita:4100,  receitaFmt:'R$ 4.100/mês',  status:CONTRACT_STATUS.EXPIRING, risco:SEVERITY.HIGH,     estado:OPERATIONAL_STATE.WARNING,  probabilidadeRenovacao:0.55, acaoRecomendada:'Proposta de renovação amanhã',  impactoAnual:49200   },
  { id:'CTR-1890', cliente:'Comércio Paraná LTDA',       regiao:'Paraná',            placas:1, inicioVigencia:'2025-04-20', vencimento:'2026-09-20', diasRestantes:124,receita:2100,  receitaFmt:'R$ 2.100/mês',  status:CONTRACT_STATUS.ACTIVE,   risco:SEVERITY.INFO,     estado:OPERATIONAL_STATE.HEALTHY,  probabilidadeRenovacao:0.80, acaoRecomendada:'Recém iniciado — monitorar',    impactoAnual:25200   },
  { id:'CTR-1750', cliente:'Supermercado Nação SP',      regiao:'São Paulo',         placas:1, inicioVigencia:'2025-01-01', vencimento:'2026-12-31', diasRestantes:226,receita:7400,  receitaFmt:'R$ 7.400/mês',  status:CONTRACT_STATUS.ACTIVE,   risco:SEVERITY.INFO,     estado:OPERATIONAL_STATE.HEALTHY,  probabilidadeRenovacao:0.95, acaoRecomendada:'Propor expansão para março',    impactoAnual:88800   },
  { id:'CTR-1620', cliente:'Fintech Capital',            regiao:'São Paulo',         placas:2, inicioVigencia:'2025-05-01', vencimento:'2026-11-30', diasRestantes:195,receita:12000, receitaFmt:'R$ 12.000/mês', status:CONTRACT_STATUS.ACTIVE,   risco:SEVERITY.INFO,     estado:OPERATIONAL_STATE.HEALTHY,  probabilidadeRenovacao:0.91, acaoRecomendada:'Oportunidade de expansão —DF', impactoAnual:144000  },
  { id:'CTR-1500', cliente:'Rede Farmácias Vitalis',     regiao:'Rio Grande do Sul', placas:1, inicioVigencia:'2024-09-01', vencimento:'2026-05-31', diasRestantes:12, receita:3100,  receitaFmt:'R$ 3.100/mês',  status:CONTRACT_STATUS.EXPIRING, risco:SEVERITY.HIGH,     estado:OPERATIONAL_STATE.WARNING,  probabilidadeRenovacao:0.60, acaoRecomendada:'Reunião esta semana',           impactoAnual:37200   },
  { id:'CTR-1380', cliente:'Construtora Horizonte',      regiao:'Minas Gerais',      placas:1, inicioVigencia:'2024-08-15', vencimento:'2026-08-15', diasRestantes:88, receita:5500,  receitaFmt:'R$ 5.500/mês',  status:CONTRACT_STATUS.ACTIVE,   risco:SEVERITY.LOW,      estado:OPERATIONAL_STATE.HEALTHY,  probabilidadeRenovacao:0.75, acaoRecomendada:'Avaliar expansão Savassi',      impactoAnual:66000   },
  { id:'CTR-1210', cliente:'Logística Rota Sul',         regiao:'Rio Grande do Sul', placas:1, inicioVigencia:'2024-10-01', vencimento:'2026-06-30', diasRestantes:42, receita:4100,  receitaFmt:'R$ 4.100/mês',  status:CONTRACT_STATUS.EXPIRING, risco:SEVERITY.MEDIUM,   estado:OPERATIONAL_STATE.WARNING,  probabilidadeRenovacao:0.70, acaoRecomendada:'Proposta de renovação + bundle', impactoAnual:49200  },
];

/* ── RESUMO CONTRATOS ────────────────────────────────────────── */
export const CONTRACTS_SUMMARY = {
  total:              143,
  ativos:             128,
  vencendoEm30Dias:   11,
  renovadosEsteMes:    8,
  receitaComprometida: 284750,
  receitaEmRisco:      34400,
  riscoAnual:         412800,
  ticketMedio:         2655,
};

/* ── FINANCIAL IMPACT ────────────────────────────────────────── */
export const FINANCIAL_IMPACT = {
  receitaProtegida:   250350,
  receitaEmRisco:      34400,
  potencialExpansao:   38900,
  previsaoProximoMes: 299000,
  crescimentoEsperado: 0.051,
};

/* ── RENEWAL OPPORTUNITIES ───────────────────────────────────── */
export const RENEWAL_OPPORTUNITIES = [
  { cliente:'Grupo Azul Publicidade',  potencial:'R$ 18.400/mês', crescimento:'+12%', expansao:'Adicionar Consolação ao bundle',    chance:0.88, prazo:'7 dias'  },
  { cliente:'Meridian Media',          potencial:'R$ 8.700/mês',  crescimento:'+28%', expansao:'Incluir corredor BH-Betim',         chance:0.78, prazo:'24 dias' },
  { cliente:'Anunciante Nacional X',   potencial:'R$ 4.100/mês',  crescimento:'0%',   expansao:'Manter posição atual',             chance:0.55, prazo:'19 dias' },
  { cliente:'Rede Farmácias Vitalis',  potencial:'R$ 6.200/mês',  crescimento:'+100%',expansao:'Adicionar Freeway ao kit',          chance:0.60, prazo:'12 dias' },
  { cliente:'Logística Rota Sul',      potencial:'R$ 4.100/mês',  crescimento:'0%',   expansao:'Propor bundle Freeway + Ipiranga', chance:0.70, prazo:'42 dias' },
];

/* ── CONTRACT TIMELINE ───────────────────────────────────────── */
export const CONTRACT_TIMELINE = [
  { id:'ct-1', tipo:'renovacao',   icone:'autorenew',    label:'CTR-2847 — Grupo Azul — renovação confirmada',     tempo:'há 15min',   cat:'success' },
  { id:'ct-2', tipo:'alerta',      icone:'warning',      label:'CTR-1500 — Farmácias Vitalis — vence em 12 dias',  tempo:'há 1h',      cat:'warning' },
  { id:'ct-3', tipo:'ativacao',    icone:'check_circle', label:'CTR-1620 — Fintech Capital — ativado (2 placas)',   tempo:'há 3h',      cat:'success' },
  { id:'ct-4', tipo:'alteracao',   icone:'edit',         label:'CTR-2712 — Meridian — ajuste de prazo aprovado',   tempo:'ontem',      cat:'info'    },
  { id:'ct-5', tipo:'encerramento',icone:'cancel',       label:'CTR-1088 — Encerrado — cliente solicitou saída',   tempo:'há 2 dias',  cat:'danger'  },
  { id:'ct-6', tipo:'renovacao',   icone:'autorenew',    label:'CTR-2310 — Pharma Brasil — 12 meses renovados',    tempo:'há 3 dias',  cat:'success' },
  { id:'ct-7', tipo:'ativacao',    icone:'check_circle', label:'CTR-1890 — Comércio PR — primeira ativação OK',    tempo:'há 4 dias',  cat:'success' },
  { id:'ct-8', tipo:'alerta',      icone:'warning',      label:'CTR-2901 — FastFood — pendente proposta final',    tempo:'há 5 dias',  cat:'warning' },
];
