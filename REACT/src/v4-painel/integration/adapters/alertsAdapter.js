// @deprecated — orphaned preview adapter; not imported by any production component.
// Mock data removed. Functions return empty/safe results.
import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { PRIORITY } from '../../foundation/priorities.js';
import { SEVERITY } from '../../foundation/severityLevels.js';

const BOARD_STATUS = { RESERVED: 'reserved', OCCUPIED: 'occupied', AVAILABLE: 'available', MAINTENANCE: 'maintenance', CRITICAL: 'critical' };
const ALERT_CATEGORY = { CONTRATO: 'contrato', COMERCIAL: 'comercial', MANUTENCAO: 'manutencao', REGIONAL: 'regional', OPERACIONAL: 'operacional', SISTEMA: 'sistema' };
const ALERT_RECOMMENDATIONS = [];
const ALERT_TIMELINE_ITEMS = [];
const ALERTS_FULL = [];

const SEVERITY_COLOR = {
  critical: 'var(--v4p-danger)',
  warning: 'var(--v4p-warning)',
  info: 'var(--v4p-info)',
};

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

function toLegacySeverity(severity) {
  if (severity === 'critical') return SEVERITY.CRITICAL;
  if (severity === 'warning') return SEVERITY.MEDIUM;
  return SEVERITY.INFO;
}

function toOperationalState(severity) {
  if (severity === 'critical') return OPERATIONAL_STATE.CRITICAL;
  if (severity === 'warning') return OPERATIONAL_STATE.WARNING;
  return OPERATIONAL_STATE.HEALTHY;
}

function toPriority(severity) {
  if (severity === 'critical') return PRIORITY.URGENT;
  if (severity === 'warning') return PRIORITY.HIGH;
  return PRIORITY.NORMAL;
}

function makeAlert({
  id,
  title,
  description,
  severity,
  category,
  source = 'derived',
  entityType = 'system',
  entityId = null,
  region = 'Todos',
  impact = 'Monitorar',
  recommendation = null,
  createdAt = new Date().toISOString(),
  status = 'open',
  owner = 'Operacoes',
  sla = '24h',
}) {
  const legacySeverity = toLegacySeverity(severity);
  const legacyState = toOperationalState(severity);
  const legacyPriority = toPriority(severity);
  const regionList = Array.isArray(region) ? region : [region];

  return {
    id,
    title,
    description,
    severity,
    category,
    source,
    entityType,
    entityId,
    region: regionList[0] ?? 'Todos',
    impact,
    recommendation,
    createdAt,
    status,
    owner,
    sla,

    // Legacy aliases for existing UI components.
    titulo: title,
    descricao: description,
    severidade: legacySeverity,
    categoria: category,
    estado: legacyState,
    prioridade: legacyPriority,
    impacto: impact,
    acao: recommendation,
    regioesAfetadas: regionList,
    timestamp: createdAt,
    lido: status === 'resolved',
    historico: [{ tempo: 'agora', evento: 'Alerta derivado dos dados operacionais' }],
  };
}

function buildSeverityOverview(alerts) {
  const counts = {
    critical: alerts.filter((item) => item.severity === 'critical').length,
    warning: alerts.filter((item) => item.severity === 'warning').length,
    info: alerts.filter((item) => item.severity === 'info').length,
  };

  return {
    critical: { count: counts.critical, cor: SEVERITY_COLOR.critical, label: 'Critico' },
    high: { count: counts.warning, cor: SEVERITY_COLOR.warning, label: 'Alto' },
    medium: { count: 0, cor: SEVERITY_COLOR.warning, label: 'Medio' },
    low: { count: 0, cor: 'var(--v4p-text-4)', label: 'Baixo' },
    info: { count: counts.info, cor: SEVERITY_COLOR.info, label: 'Informativo' },
  };
}

function recommendationsFrom(alerts) {
  const recs = alerts.slice(0, 4).map((alert) => ({
    id: `rec-${alert.id}`,
    icone: alert.severity === 'critical' ? 'crisis_alert' : 'task_alt',
    titulo: alert.recommendation ?? alert.title,
    descricao: alert.description,
    prazo: alert.sla ?? 'Hoje',
    cor: alert.severity === 'critical' ? SEVERITY_COLOR.critical : alert.severity === 'warning' ? SEVERITY_COLOR.warning : SEVERITY_COLOR.info,
  }));
  return recs.length ? recs : ALERT_RECOMMENDATIONS;
}

function timelineFrom(alerts) {
  const items = alerts.slice(0, 10).map((alert) => ({
    tempo: 'agora',
    evento: alert.title,
    tipo: alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info',
    id: alert.id,
  }));
  return items.length ? items : ALERT_TIMELINE_ITEMS;
}

export function createMockAlertsSnapshot() {
  const alerts = ALERTS_FULL.map((item) => ({
    ...item,
    title: item.titulo,
    description: item.descricao,
    severity: item.severidade === SEVERITY.CRITICAL || item.severidade === SEVERITY.HIGH
      ? 'critical'
      : item.severidade === SEVERITY.MEDIUM
        ? 'warning'
        : 'info',
    category: item.categoria,
    source: 'mock',
    entityType: 'system',
    entityId: null,
    region: item.regioesAfetadas?.[0] ?? 'Todos',
    impact: item.impacto,
    recommendation: item.acao,
    createdAt: item.timestamp,
    status: item.lido ? 'resolved' : 'open',
    owner: item.owner,
    sla: item.sla,
  }));

  return {
    generatedAt: null,
    totals: {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
      resolved: alerts.filter((a) => a.lido).length,
      open: alerts.filter((a) => !a.lido).length,
    },
    alerts,
    severityOverview: buildSeverityOverview(alerts),
    recommendations: ALERT_RECOMMENDATIONS.map((item) => ({ ...item })),
    timeline: ALERT_TIMELINE_ITEMS.map((item) => ({ ...item })),
  };
}

export function alertsFromSources({ inventorySummary, contractsPayload, boards = [], sourceErrors = [] } = {}) {
  const fallback = createMockAlertsSnapshot();
  if (!inventorySummary && !contractsPayload && !boards.length && !sourceErrors.length) return fallback;

  const alerts = [];
  const totals = inventorySummary?.totals ?? {};
  const revenue = contractsPayload?.summary?.receitaEmRisco ?? contractsPayload?.rawSummary?.revenue?.revenueAtRisk;
  const expiring7 = num(contractsPayload?.rawSummary?.totals?.expiring7Days ?? inventorySummary?.expiringContracts?.next7Days);
  const expiring15 = num(contractsPayload?.rawSummary?.totals?.expiring15Days ?? inventorySummary?.expiringContracts?.next15Days);
  const expiring30 = num(contractsPayload?.summary?.vencendoEm30Dias ?? contractsPayload?.rawSummary?.totals?.expiring30Days ?? inventorySummary?.expiringContracts?.next30Days);

  if (expiring7 > 0) {
    alerts.push(makeAlert({
      id: 'real-contracts-7',
      title: `${expiring7} contratos vencem em ate 7 dias`,
      description: 'Contratos operacionais proximos do vencimento exigem acao comercial imediata.',
      category: ALERT_CATEGORY.CONTRATO,
      severity: 'critical',
      source: 'contracts',
      entityType: 'contract',
      sla: '8h',
      owner: 'Comercial',
      impact: `${brl(revenue)}/mes em risco`,
      recommendation: 'Priorizar renovacoes criticas',
    }));
  }

  if (expiring15 > 0) {
    alerts.push(makeAlert({
      id: 'real-contracts-15',
      title: `${expiring15} contratos vencem em ate 15 dias`,
      description: 'Contratos em janela de atencao para renovacao comercial.',
      category: ALERT_CATEGORY.CONTRATO,
      severity: 'warning',
      source: 'contracts',
      entityType: 'contract',
      sla: '24h',
      owner: 'Comercial',
      impact: `${brl(revenue)}/mes em risco`,
      recommendation: 'Montar plano de renovacao por prioridade',
    }));
  }

  if (expiring30 > 0) {
    alerts.push(makeAlert({
      id: 'real-contracts-30',
      title: `${expiring30} contratos vencem nos proximos 30 dias`,
      description: 'Carteira com contratos em janela ampliada de renovacao.',
      category: ALERT_CATEGORY.CONTRATO,
      severity: 'info',
      source: 'contracts',
      entityType: 'contract',
      sla: '72h',
      owner: 'Comercial',
      impact: `${brl(revenue)}/mes potencialmente impactados`,
      recommendation: 'Preparar abordagem antecipada de renovacao',
    }));
  }

  if (num(revenue) > 0) {
    alerts.push(makeAlert({
      id: 'real-revenue-at-risk',
      title: 'Receita em risco identificada na carteira ativa',
      description: 'Receita mensal associada a contratos criticos requer plano de mitigacao.',
      category: ALERT_CATEGORY.COMERCIAL,
      severity: num(revenue) >= 50000 ? 'critical' : 'warning',
      source: 'contracts',
      entityType: 'portfolio',
      impact: `${brl(revenue)}/mes`,
      recommendation: 'Escalonar estrategia de retencao para contas chave',
    }));
  }

  if (num(totals.maintenanceBoards) > 0) {
    alerts.push(makeAlert({
      id: 'real-maintenance',
      title: `${totals.maintenanceBoards} placas em manutencao`,
      description: 'Placas indisponiveis reduzem a capacidade comercial e operacional.',
      category: ALERT_CATEGORY.MANUTENCAO,
      severity: num(totals.maintenanceBoards) >= 5 ? 'warning' : 'info',
      source: 'inventory',
      entityType: 'board',
      owner: 'Operacoes',
      impact: 'Capacidade operacional reduzida',
      recommendation: 'Revisar fila de manutencao',
    }));
  }

  arr(inventorySummary?.highlights?.lowOccupancyRegions).slice(0, 3).forEach((region, index) => {
    const occupancyRate = num(region.occupancyRate);
    alerts.push(makeAlert({
      id: `real-low-occupancy-${region.id ?? index}`,
      title: `Baixa ocupacao em ${region.name ?? 'regiao'}`,
      description: 'Regiao com ocupacao abaixo do esperado e potencial comercial parado.',
      category: ALERT_CATEGORY.REGIONAL,
      severity: occupancyRate < 0.5 ? 'critical' : 'warning',
      source: 'inventory',
      entityType: 'region',
      entityId: region.id ?? null,
      owner: 'Comercial',
      region: region.name ?? 'Regiao',
      impact: 'Receita potencial parada',
      recommendation: 'Ativar prospeccao regional',
    }));
  });

  const missingImage = boards.filter((board) => !board.imageUrl || String(board.imageUrl).includes('placeholder')).length;
  const missingCoords = boards.filter((board) => board.lat == null || board.lng == null).length;
  const missingRegion = boards.filter((board) => !board.regiao || board.regiao === 'Sem região').length;
  const reservedWithoutFormalContract = boards.filter((board) => board.status === BOARD_STATUS.RESERVED && !board.cliente).length;
  const incomplete = missingImage + missingCoords + missingRegion;

  if (missingImage > 0) {
    alerts.push(makeAlert({
      id: 'real-missing-image',
      title: `${missingImage} placas sem imagem operacional`,
      description: 'Cadastros sem imagem dificultam validacao comercial e auditoria visual.',
      category: ALERT_CATEGORY.OPERACIONAL,
      severity: 'warning',
      source: 'boards',
      entityType: 'board',
      impact: 'Qualidade de inventario reduzida',
      recommendation: 'Priorizar upload de imagens nas placas pendentes',
    }));
  }

  if (missingRegion > 0) {
    alerts.push(makeAlert({
      id: 'real-missing-region',
      title: `${missingRegion} placas sem regiao definida`,
      description: 'Registros sem regiao comprometem analise e roteamento operacional.',
      category: ALERT_CATEGORY.OPERACIONAL,
      severity: 'warning',
      source: 'boards',
      entityType: 'board',
      impact: 'Classificacao regional inconsistente',
      recommendation: 'Completar regiao nos cadastros pendentes',
    }));
  }

  if (missingCoords > 0) {
    alerts.push(makeAlert({
      id: 'real-missing-coordinates',
      title: `${missingCoords} placas sem coordenadas`,
      description: 'Placas sem geolocalizacao impactam mapa e analises espaciais.',
      category: ALERT_CATEGORY.OPERACIONAL,
      severity: 'info',
      source: 'boards',
      entityType: 'board',
      impact: 'Cobertura de mapa parcial',
      recommendation: 'Atualizar coordenadas geograficas',
    }));
  }

  if (reservedWithoutFormalContract > 0) {
    alerts.push(makeAlert({
      id: 'real-reserved-no-contract',
      title: `${reservedWithoutFormalContract} placas reservadas sem contrato formal`,
      description: 'Existe reserva operacional sem contrato formal identificado.',
      category: ALERT_CATEGORY.CONTRATO,
      severity: 'warning',
      source: 'boards',
      entityType: 'board',
      impact: 'Risco de governanca comercial',
      recommendation: 'Validar formalizacao contratual das reservas',
    }));
  }

  if (incomplete > 0) {
    alerts.push(makeAlert({
      id: 'real-data-quality',
      title: `${incomplete} pendencias cadastrais no inventario`,
      description: `Sem imagem: ${missingImage}. Sem coordenada: ${missingCoords}. Sem regiao: ${missingRegion}.`,
      category: ALERT_CATEGORY.OPERACIONAL,
      severity: 'warning',
      source: 'boards',
      entityType: 'board',
      owner: 'Cadastro',
      impact: 'Qualidade dos dados operacional',
      recommendation: 'Completar cadastro das placas',
    }));
  }

  sourceErrors.forEach((message, index) => {
    alerts.push(makeAlert({
      id: `real-source-error-${index}`,
      title: 'Falha ao carregar fonte operacional',
      description: message,
      category: ALERT_CATEGORY.SISTEMA,
      severity: 'critical',
      source: 'system',
      entityType: 'api',
      owner: 'Sistema',
      impact: 'Dados operacionais podem estar parciais',
      recommendation: 'Verificar conectividade da API',
    }));
  });

  const safeAlerts = alerts.length
    ? alerts
    : [
        makeAlert({
          id: 'real-no-critical',
          title: 'Nenhum alerta critico derivado',
          description: 'As fontes reais nao indicaram anomalias criticas neste ciclo.',
          category: ALERT_CATEGORY.SISTEMA,
          severity: 'info',
          source: 'system',
          entityType: 'summary',
          owner: 'Sistema',
          status: 'resolved',
        }),
      ];

  const overview = buildSeverityOverview(safeAlerts);

  return {
    generatedAt: inventorySummary?.generatedAt ?? contractsPayload?.generatedAt ?? new Date().toISOString(),
    totals: {
      critical: overview.critical.count,
      warning: overview.high.count,
      info: overview.info.count,
      resolved: safeAlerts.filter((a) => a.lido).length,
      open: safeAlerts.filter((a) => !a.lido).length,
    },
    alerts: safeAlerts,
    severityOverview: overview,
    recommendations: recommendationsFrom(safeAlerts),
    timeline: timelineFrom(safeAlerts),
  };
}
