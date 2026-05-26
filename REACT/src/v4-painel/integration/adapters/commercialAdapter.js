import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { PRIORITY } from '../../foundation/priorities.js';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function brl(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(num(value));
}

function unwrap(payload, key) {
  const raw = payload?.data ?? payload ?? {};
  if (Array.isArray(raw)) return raw;
  if (key && Array.isArray(raw[key])) return raw[key];
  return raw;
}

export const EMPTY_COMMERCIAL_SNAPSHOT = {
  generatedAt: null,
  kpis: {
    activeRevenue: 0,
    revenueAtRisk: 0,
    renewalPotential: 0,
    availableInventoryPotential: 0,
    activeContracts: 0,
    expiringContracts: 0,
  },
  hero: {
    pipelineLabel: 'R$ 0',
    conversionLabel: '0%',
    slaLabel: '0h',
  },
  pipeline: {
    stages: [],
    summary: {
      taxaConversaoGlobal: 0,
      cicloMedioVendas: 0,
      ticketMedioFechado: 0,
      receitaNoMes: 0,
      metaMensal: 0,
      crescimentoMoM: 0,
    },
  },
  opportunities: [],
  proposals: [],
  conversions: [],
  activities: [],
  revenueForecast: {
    metaAnual: 0,
    realizadoAnual: 0,
    projetadoAnual: 0,
    percentMeta: 0,
    receitaRecorrente: 0,
    crescimentoMoM: 0,
    trimestres: [],
    meses: [],
  },
  regionalPerformance: [],
  sellersPerformance: [],
  salesTargets: {
    metaMensal: 0,
    realizado: 0,
    percentual: 0,
    faltaParaMeta: 0,
    diasRestantes: 0,
    projecaoFinal: 0,
  },
  insights: [],
};

function priorityFromDays(days) {
  if (days == null) return PRIORITY.NORMAL;
  if (days <= 7) return PRIORITY.URGENT;
  if (days <= 30) return PRIORITY.HIGH;
  return PRIORITY.NORMAL;
}

function stateFromRisk(risk) {
  if (risk === 'critical') return OPERATIONAL_STATE.CRITICAL;
  if (risk === 'high' || risk === 'medium') return OPERATIONAL_STATE.WARNING;
  return OPERATIONAL_STATE.HEALTHY;
}

function opportunityFromContract(contract, index) {
  const potential = num(contract.receita ?? contract.monthlyValue);
  const days = contract.diasRestantes ?? contract.daysToExpire;
  return {
    id: `renew-${contract.realId ?? contract.id ?? index}`,
    cliente: contract.cliente ?? contract.clientName ?? 'Cliente nao informado',
    regiao: contract.regiao ?? contract.region?.name ?? 'Sem regiao',
    potencial: potential,
    potencialFmt: `${brl(potential)}/mes`,
    prioridade: priorityFromDays(days),
    status: days != null && days <= 15 ? 'Fechamento' : 'Negociação',
    chance: num(contract.probabilidadeRenovacao ?? contract.renewalProbability, 0.65),
    tags: ['renovacao', 'contrato'],
    recomendacao: days != null
      ? `Renovar contrato nos proximos ${Math.max(days, 0)} dias.`
      : 'Validar janela de renovacao com o cliente.',
    estado: stateFromRisk(contract.risco ?? contract.riskLevel),
  };
}

function lowOccupancyOpportunity(region, index) {
  const potential = num(region.estimatedAvailableRevenue ?? region.availableRevenue ?? 0);
  return {
    id: `region-${region.id ?? index}`,
    cliente: `Ativacao regional - ${region.name ?? region.regiao ?? 'Regiao'}`,
    regiao: region.name ?? region.regiao ?? 'Sem regiao',
    potencial: potential,
    potencialFmt: `${brl(potential)}/mes`,
    prioridade: PRIORITY.NORMAL,
    status: 'Lead',
    chance: 0.35,
    tags: ['inventario', 'baixa ocupacao'],
    recomendacao: 'Prospectar campanhas para placas disponiveis nesta regiao.',
    estado: OPERATIONAL_STATE.WARNING,
  };
}

export function createEmptyCommercialSnapshot() {
  return {
    ...EMPTY_COMMERCIAL_SNAPSHOT,
    kpis: { ...EMPTY_COMMERCIAL_SNAPSHOT.kpis },
    hero: { ...EMPTY_COMMERCIAL_SNAPSHOT.hero },
    pipeline: {
      stages: [],
      summary: { ...EMPTY_COMMERCIAL_SNAPSHOT.pipeline.summary },
    },
    opportunities: [],
    proposals: [],
    conversions: [],
    activities: [],
    revenueForecast: {
      ...EMPTY_COMMERCIAL_SNAPSHOT.revenueForecast,
      trimestres: [],
      meses: [],
    },
    regionalPerformance: [],
    sellersPerformance: [],
    salesTargets: { ...EMPTY_COMMERCIAL_SNAPSHOT.salesTargets },
    insights: [],
  };
}

export function normalizeCommercialPipeline(payload) {
  const raw = unwrap(payload);
  const stages = arr(raw.stages).map((stage, index) => {
    const value = num(stage.value ?? stage.valor);
    const count = num(stage.count);
    return {
      id: stage.id ?? stage.name ?? `stage-${index}`,
      label: stage.label ?? stage.name ?? 'Etapa',
      count,
      conversao: stage.conversionRate ?? stage.conversao ?? null,
      valor: brl(value),
      cor: stage.color ?? ['var(--v4p-text-4)', 'var(--v4p-accent)', 'var(--v4p-warning)', 'var(--v4p-success)'][index % 4],
      rawValue: value,
    };
  });
  const totalValue = num(raw.totalValue);
  const count = num(raw.count);
  const conversionRate = num(raw.conversionRate);

  return {
    hero: {
      pipelineLabel: brl(totalValue),
      conversionLabel: `${Math.round(conversionRate * 100)}%`,
      slaLabel: `${num(raw.slaHours)}h`,
    },
    pipeline: {
      stages,
      summary: {
        taxaConversaoGlobal: conversionRate,
        cicloMedioVendas: num(raw.averageCycleDays),
        ticketMedioFechado: count ? Math.round(totalValue / count) : 0,
        receitaNoMes: totalValue,
        metaMensal: num(raw.monthlyTarget),
        crescimentoMoM: num(raw.growthMoM),
      },
    },
    kpis: {
      activeRevenue: totalValue,
      revenueAtRisk: 0,
      renewalPotential: totalValue,
      availableInventoryPotential: 0,
      activeContracts: 0,
      expiringContracts: 0,
    },
    generatedAt: raw.generatedAt ?? null,
  };
}

export function normalizeCommercialOpportunities(payload) {
  return arr(unwrap(payload, 'opportunities')).map((item, index) => {
    const potential = num(item.potencial ?? item.value);
    const stage = item.status ?? item.stage ?? 'lead';
    return {
      id: item.id ?? item.realId ?? `opportunity-${index}`,
      realId: item.realId ?? item.id ?? null,
      cliente: item.cliente ?? item.clientName ?? item.clientId ?? 'Cliente nao informado',
      regiao: item.regiao ?? item.regionName ?? item.region ?? 'Sem regiao',
      potencial: potential,
      potencialFmt: `${brl(potential)}/mes`,
      prioridade: item.prioridade ?? item.priority ?? PRIORITY.NORMAL,
      status: item.statusLabel ?? stage,
      stage,
      chance: num(item.chance ?? item.probability, 0),
      tags: arr(item.tags).length ? arr(item.tags) : ['real'],
      recomendacao: item.recomendacao ?? item.note ?? 'Acompanhar oportunidade comercial.',
      estado: item.estado ?? stateFromRisk(item.riskLevel),
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
    };
  });
}

export function normalizeCommercialProposals(payload) {
  return arr(unwrap(payload, 'proposals'));
}

export function normalizeCommercialConversions(payload) {
  const raw = unwrap(payload);
  const conversions = arr(raw.conversions);
  const totalValue = conversions.reduce((sum, item) => sum + num(item.value), 0);
  const rate = num(raw.rate);

  return {
    conversions,
    total: num(raw.total, conversions.length),
    rate,
    revenueForecast: {
      ...EMPTY_COMMERCIAL_SNAPSHOT.revenueForecast,
      realizadoAnual: totalValue,
      projetadoAnual: totalValue,
      percentMeta: rate,
      receitaRecorrente: totalValue,
    },
    regionalPerformance: arr(raw.regionalPerformance),
    sellersPerformance: arr(raw.sellersPerformance),
    salesTargets: {
      ...EMPTY_COMMERCIAL_SNAPSHOT.salesTargets,
      realizado: totalValue,
      percentual: rate,
      projecaoFinal: totalValue,
    },
  };
}

export function normalizeCommercialActivities(payload) {
  const activities = arr(unwrap(payload, 'activities'));
  return activities.map((item, index) => ({
    id: item.id ?? `activity-${index}`,
    tipo: item.type ?? item.tipo ?? 'atividade',
    icone: item.icon ?? 'task_alt',
    titulo: item.title ?? item.note ?? 'Atividade comercial',
    descricao: item.description ?? item.note ?? 'Registro comercial real.',
    impacto: item.impact ?? item.status ?? 'registrado',
    cor: item.color ?? 'var(--v4p-accent)',
    raw: item,
  }));
}

export function commercialFromSources({ contractsPayload, inventorySummary } = {}) {
  const fallback = createEmptyCommercialSnapshot();
  if (!contractsPayload && !inventorySummary) return fallback;

  const contractSummary = contractsPayload?.summary ?? {};
  const rawContractSummary = contractsPayload?.rawSummary ?? {};
  const inventoryRevenue = inventorySummary?.revenue ?? {};
  const inventoryHighlights = inventorySummary?.highlights ?? {};
  const inventoryRegions = arr(inventorySummary?.regions);

  const activeRevenue = num(contractSummary.receitaComprometida, num(inventoryRevenue.activeMonthlyRevenue, fallback.kpis.activeRevenue));
  const revenueAtRisk = num(contractSummary.receitaEmRisco);
  const expiringContracts = num(contractSummary.vencendoEm30Dias);
  const activeContracts = num(contractSummary.ativos);
  const availableInventoryPotential = num(inventoryRevenue.estimatedAvailableRevenue);

  const renewalOpportunities = arr(contractsPayload?.contracts)
    .filter((contract) => contract.status === 'expiring' || num(contract.diasRestantes, 999) <= 30)
    .slice(0, 8)
    .map(opportunityFromContract);

  const regionalInventoryOpps = arr(inventoryHighlights.lowOccupancyRegions)
    .slice(0, 3)
    .map(lowOccupancyOpportunity);

  const opportunities = [...renewalOpportunities, ...regionalInventoryOpps];
  const safeOpportunities = opportunities;
  const renewalPotential = safeOpportunities.reduce((sum, item) => sum + num(item.potencial), 0);

  const regionalPerformance = inventoryRegions.length
    ? inventoryRegions.map((region, index) => {
        const revenue = num(region.activeRevenue);
        const occupancy = num(region.occupancyRate);
        return {
          id: region.id ?? `region-${index}`,
          regiao: region.name ?? 'Sem regiao',
          receita: revenue,
          meta: Math.max(revenue, Math.round(revenue / 0.9), 1),
          percent: revenue > 0 ? 0.9 : occupancy,
          ocupacaoGerada: occupancy,
          crescimento: occupancy >= 0.8 ? '+8%' : occupancy >= 0.65 ? '+3%' : '-4%',
          rank: index + 1,
          tendencia: occupancy >= 0.8 ? 'alta' : occupancy >= 0.65 ? 'estável' : 'queda',
          responsavel: 'Comercial',
        };
      })
    : fallback.regionalPerformance;

  const insights = [
    revenueAtRisk > 0 && {
      id: 'real-risk',
      tipo: 'urgente',
      icone: 'crisis_alert',
      titulo: `${expiringContracts} contratos vencendo nos proximos 30 dias`,
      descricao: `${brl(revenueAtRisk)}/mes em risco direto. Priorizar renovacoes da carteira ativa.`,
      impacto: `${brl(revenueAtRisk * 12)}/ano`,
      cor: 'var(--v4p-danger)',
    },
    availableInventoryPotential > 0 && {
      id: 'real-inventory',
      tipo: 'ativacao',
      icone: 'location_on',
      titulo: 'Inventario disponivel com potencial comercial',
      descricao: `${brl(availableInventoryPotential)}/mes estimados em placas disponiveis. Direcionar prospeccao por regiao.`,
      impacto: `${brl(availableInventoryPotential * 12)}/ano`,
      cor: 'var(--v4p-warning)',
    },
  ].filter(Boolean);

  return {
    ...fallback,
    generatedAt: rawContractSummary.generatedAt ?? inventorySummary?.generatedAt ?? null,
    kpis: {
      activeRevenue,
      revenueAtRisk,
      renewalPotential,
      availableInventoryPotential,
      activeContracts,
      expiringContracts,
    },
    hero: {
      pipelineLabel: brl(renewalPotential || fallback.pipeline.summary.receitaNoMes),
      conversionLabel: `${Math.round(fallback.pipeline.summary.taxaConversaoGlobal * 100)}%`,
      slaLabel: fallback.hero.slaLabel,
    },
    pipeline: fallback.pipeline,
    opportunities: safeOpportunities,
    regionalPerformance,
    insights,
    salesTargets: {
      ...fallback.salesTargets,
      realizado: Math.min(activeRevenue, fallback.salesTargets.metaMensal),
      percentual: Math.min(activeRevenue / Math.max(fallback.salesTargets.metaMensal, 1), 1),
      faltaParaMeta: Math.max(fallback.salesTargets.metaMensal - activeRevenue, 0),
      projecaoFinal: Math.max(activeRevenue, fallback.salesTargets.projecaoFinal),
    },
    revenueForecast: {
      ...fallback.revenueForecast,
      receitaRecorrente: activeRevenue,
      projetadoAnual: activeRevenue * 12,
    },
  };
}
