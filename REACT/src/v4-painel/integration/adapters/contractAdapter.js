import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { SEVERITY } from '../../foundation/severityLevels.js';

const STATUS_TO_UI = {
  active: 'active',
  expiring: 'expiring',
  expired: 'expired',
  future: 'draft',
  cancelled: 'paused',
  completed: 'expired',
};

const STATE_BY_RISK = {
  low: OPERATIONAL_STATE.HEALTHY,
  medium: OPERATIONAL_STATE.WARNING,
  high: OPERATIONAL_STATE.WARNING,
  critical: OPERATIONAL_STATE.CRITICAL,
};

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function unwrap(payload) {
  const raw = payload?.data ?? payload ?? {};
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.contracts)) return raw.contracts;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.results)) return raw.results;
  return raw;
}

function brl(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(num(value));
}

function isoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export const EMPTY_CONTRACTS_SUMMARY = {
  total: 0,
  ativos: 0,
  vencendoEm30Dias: 0,
  renovadosEsteMes: 0,
  receitaComprometida: 0,
  receitaEmRisco: 0,
  riscoAnual: 0,
  ticketMedio: 0,
};

export const EMPTY_FINANCIAL_IMPACT = {
  receitaProtegida: 0,
  receitaEmRisco: 0,
  potencialExpansao: 0,
  previsaoProximoMes: 0,
  crescimentoEsperado: 0,
};

export const EMPTY_CONTRACTS_PAYLOAD = {
  contracts: [],
  summary: EMPTY_CONTRACTS_SUMMARY,
  financialImpact: EMPTY_FINANCIAL_IMPACT,
  renewalOpportunities: [],
  timeline: [],
  rawSummary: null,
  generatedAt: null,
};

export function normalizeOperationalContract(raw = {}) {
  const monthlyValue = num(raw.monthlyValue);
  const risk = raw.riskLevel ?? SEVERITY.LOW;
  const status = raw.status ?? 'active';
  const daysToExpire = raw.daysToExpire == null ? null : num(raw.daysToExpire);
  const regionName = raw.region?.name ?? raw.region ?? 'Sem regiao';

  return {
    id: raw.code ?? raw.id ?? 'CTR-0000',
    realId: raw.id ?? raw._id ?? null,
    code: raw.code ?? raw.id ?? null,
    cliente: raw.clientName ?? 'Cliente nao informado',
    campanha: raw.campaignName ?? 'Contrato operacional',
    boardId: raw.boardId ?? null,
    boardCode: raw.boardCode ?? null,
    boardLocation: raw.boardLocation ?? null,
    regiao: regionName,
    placas: 1,
    inicioVigencia: isoDate(raw.startDate),
    vencimento: isoDate(raw.endDate),
    diasRestantes: daysToExpire,
    receita: monthlyValue,
    receitaFmt: `${brl(monthlyValue)}/mes`,
    status: STATUS_TO_UI[status] ?? status,
    operationalStatus: status,
    risco: risk,
    estado: STATE_BY_RISK[risk] ?? OPERATIONAL_STATE.HEALTHY,
    probabilidadeRenovacao: num(raw.renewalProbability, 0.7),
    acaoRecomendada: daysToExpire != null && daysToExpire <= 30
      ? 'Priorizar contato de renovacao'
      : 'Monitorar carteira',
    impactoAnual: monthlyValue * 12,
    owner: raw.owner ?? null,
    source: raw.source ?? 'real',
  };
}

export function normalizeContractsList(payload) {
  return arr(unwrap(payload)).map(normalizeOperationalContract);
}

export function normalizeContractTimeline(payload) {
  const raw = unwrap(payload);
  const rows = Array.isArray(raw) ? raw : arr(raw.timeline);

  return rows.map((item, index) => {
    const contract = item.contract ? normalizeOperationalContract(item.contract) : null;
    const status = item.status ?? contract?.status;
    const risk = item.riskLevel ?? contract?.risco;

    return {
      id: item.id ?? `timeline-${item.contractId ?? contract?.realId ?? index}`,
      tipo: item.type ?? 'contrato',
      icone: item.icon ?? item.icone ?? (status === 'cancelled' || status === 'expired' ? 'cancel' : 'description'),
      label: item.label ?? [
        item.contractCode ?? contract?.id,
        item.clientName ?? contract?.cliente,
        item.campaignName ?? contract?.campanha,
      ].filter(Boolean).join(' - '),
      tempo: item.timeLabel ?? item.tempo ?? item.occurredAt ?? item.createdAt ?? 'sem data',
      cat: item.category ?? item.cat ?? (risk === 'critical' || risk === 'high' ? 'warning' : 'success'),
      occurredAt: item.occurredAt ?? item.createdAt ?? null,
    };
  });
}

export function normalizeContractsSummary(payload) {
  const raw = payload?.data ?? payload ?? {};
  const contracts = arr(raw.expiringContracts).length || arr(raw.recentContracts).length
    ? [...arr(raw.expiringContracts), ...arr(raw.recentContracts)]
    : [];
  const normalized = contracts.map(normalizeOperationalContract);
  const unique = Array.from(new Map(normalized.map((item) => [item.realId ?? item.id, item])).values());
  const totals = raw.totals ?? {};
  const revenue = raw.revenue ?? {};
  const activeMonthlyRevenue = num(revenue.activeMonthlyRevenue);
  const revenueAtRisk = num(revenue.revenueAtRisk);

  return {
    contracts: unique,
    summary: {
      total: num(totals.activeContracts) + num(totals.expiredContracts) + num(totals.futureContracts),
      ativos: num(totals.activeContracts),
      vencendoEm30Dias: num(totals.expiring30Days),
      renovadosEsteMes: 0,
      receitaComprometida: activeMonthlyRevenue,
      receitaEmRisco: revenueAtRisk,
      riscoAnual: revenueAtRisk * 12,
      ticketMedio: num(totals.activeContracts) > 0 ? Math.round(activeMonthlyRevenue / num(totals.activeContracts)) : 0,
    },
    financialImpact: {
      receitaProtegida: Math.max(0, activeMonthlyRevenue - revenueAtRisk),
      receitaEmRisco: revenueAtRisk,
      potencialExpansao: num(revenue.projectedRenewalRevenue),
      previsaoProximoMes: activeMonthlyRevenue,
      crescimentoEsperado: 0,
    },
    renewalOpportunities: arr(raw.expiringContracts).slice(0, 6).map((item) => {
      const contract = normalizeOperationalContract(item);
      return {
        cliente: contract.cliente,
        potencial: `${brl(contract.receita)}/mes`,
        crescimento: '0%',
        expansao: contract.acaoRecomendada,
        chance: contract.probabilidadeRenovacao,
        prazo: contract.diasRestantes == null ? 'sem data' : `${contract.diasRestantes} dias`,
      };
    }),
    timeline: arr(raw.recentContracts).slice(0, 8).map((item, index) => {
      const contract = normalizeOperationalContract(item);
      return {
        id: `real-${contract.realId ?? index}`,
        tipo: 'contrato',
        icone: contract.status === 'expired' ? 'cancel' : 'description',
        label: `${contract.id} - ${contract.cliente} - ${contract.campanha}`,
        tempo: contract.diasRestantes == null ? 'sem vencimento' : `vence em ${contract.diasRestantes} dias`,
        cat: contract.risco === 'critical' || contract.risco === 'high' ? 'warning' : 'success',
      };
    }),
    rawSummary: raw,
    generatedAt: raw.generatedAt ?? null,
  };
}

export function mergeContractsPayload(summaryPayload, listPayload, extras = {}) {
  const summary = normalizeContractsSummary(summaryPayload);
  const listed = listPayload ? normalizeContractsList(listPayload) : [];
  const contracts = listed.length ? listed : summary.contracts;
  const timeline = extras.timeline ? normalizeContractTimeline(extras.timeline) : summary.timeline;

  return {
    ...EMPTY_CONTRACTS_PAYLOAD,
    ...summary,
    contracts,
    renewalOpportunities: summary.renewalOpportunities,
    timeline,
    activeContracts: extras.active ? normalizeContractsList(extras.active) : contracts.filter((contract) => contract.status === 'active' || contract.status === 'expiring'),
    expiringContracts: extras.expiring ? normalizeContractsList(extras.expiring) : contracts.filter((contract) => contract.status === 'expiring' || Number(contract.diasRestantes) <= 30),
  };
}

export function toBoardContracts(contracts = []) {
  return contracts.map((contract) => ({
    id: contract.id,
    cliente: contract.cliente,
    campanha: contract.campanha,
    inicio: contract.inicioVigencia,
    fim: contract.vencimento,
    valorMensal: contract.receita,
    status: contract.status === 'active' || contract.status === 'expiring' ? 'active' : 'closed',
    renovacao: contract.status === 'expiring',
    responsavelComercial: contract.owner ?? 'Comercial',
  }));
}
