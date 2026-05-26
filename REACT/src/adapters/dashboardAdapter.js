/**
 * Adapter do Dashboard.
 *
 * Converte respostas de /relatorios/dashboard-summary e /relatorios/placas-por-regiao
 * para o contrato canônico.
 */

/**
 * Normaliza o dashboard summary.
 * Garante que os três campos obrigatórios existem com tipos corretos.
 *
 * @param {unknown} payload - Resposta bruta de GET /relatorios/dashboard-summary
 * @returns {import('../contracts').DashboardSummaryCanonical}
 */
export function normalizeDashboardSummary(payload) {
  if (!payload || typeof payload !== 'object') {
    return { totalPlacas: 0, placasDisponiveis: 0, regiaoPrincipal: 'N/A' };
  }

  // Aceita tanto { data: {...} } quanto o objeto direto
  const raw = /** @type {any} */ (payload);
  const d = raw.data ?? raw;

  return {
    totalPlacas: typeof d.totalPlacas === 'number' ? d.totalPlacas : 0,
    placasDisponiveis: typeof d.placasDisponiveis === 'number' ? d.placasDisponiveis : 0,
    regiaoPrincipal: typeof d.regiaoPrincipal === 'string' && d.regiaoPrincipal
      ? d.regiaoPrincipal
      : 'N/A',
  };
}

/**
 * Normaliza o relatório de placas por região.
 * Garante que `total` (campo canônico) e `total_placas` (alias legado) existem.
 *
 * @param {unknown} payload - Resposta bruta de GET /relatorios/placas-por-regiao
 * @returns {import('../contracts').PlacasPorRegiaoItem[]}
 */
export function normalizePlacasPorRegiao(payload) {
  if (!payload) return [];

  const raw = /** @type {any} */ (payload);
  const list = Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : [];

  return list.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const i = /** @type {any} */ (item);
    const total = i.total_placas ?? i.total ?? 0;
    return {
      regiao: i.regiao ?? i.nome ?? 'Sem região',
      total,
      total_placas: total,
    };
  }).filter(Boolean);
}

function getData(payload, fallback = null) {
  if (!payload || typeof payload !== 'object') return fallback;
  const raw = /** @type {any} */ (payload);
  return raw.data ?? raw ?? fallback;
}

export function normalizeDashboardOverview(payload) {
  const d = getData(payload, {});
  return {
    totalPlacas: typeof d.totalPlacas === 'number' ? d.totalPlacas : 0,
    placasDisponiveis: typeof d.placasDisponiveis === 'number' ? d.placasDisponiveis : 0,
    placasAlugadasOcupadas: typeof d.placasAlugadasOcupadas === 'number' ? d.placasAlugadasOcupadas : 0,
    taxaOcupacao: typeof d.taxaOcupacao === 'number' ? d.taxaOcupacao : 0,
    propostasEmAberto: typeof d.propostasEmAberto === 'number' ? d.propostasEmAberto : 0,
    contratosAtivos: typeof d.contratosAtivos === 'number' ? d.contratosAtivos : 0,
    receitaEstimadaMensal: typeof d.receitaEstimadaMensal === 'number' ? d.receitaEstimadaMensal : 0,
    regioesAtivas: typeof d.regioesAtivas === 'number' ? d.regioesAtivas : 0,
  };
}

export function normalizeMostRentedBoards(payload) {
  const list = getData(payload, []);
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const i = /** @type {any} */ (item);
      return {
        placaId: String(i.placaId ?? ''),
        placa: i.placa ?? '-',
        localizacao: i.localizacao ?? 'Sem localização',
        regiao: i.regiao ?? 'Sem região',
        quantidadeAlugueisContratos: Number(i.quantidadeAlugueisContratos ?? 0),
        receitaGerada: Number(i.receitaGerada ?? 0),
        ultimaLocacao: i.ultimaLocacao ?? null,
        statusAtual: i.statusAtual === 'ocupada' ? 'ocupada' : 'disponivel',
      };
    })
    .filter(Boolean);
}

export function normalizeIdleBoards(payload) {
  const list = getData(payload, []);
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const i = /** @type {any} */ (item);
      return {
        placaId: String(i.placaId ?? ''),
        placa: i.placa ?? '-',
        diasSemAluguel: typeof i.diasSemAluguel === 'number' ? i.diasSemAluguel : null,
        nuncaAlugada: Boolean(i.nuncaAlugada),
        baixaTaxaOcupacao: Boolean(i.baixaTaxaOcupacao),
        taxaOcupacao: Number(i.taxaOcupacao ?? 0),
        regiao: i.regiao ?? 'Sem região',
        status: i.status === 'ocupada' ? 'ocupada' : 'disponivel',
        sugestaoAcao: i.sugestaoAcao ?? 'Revisar abordagem comercial.',
      };
    })
    .filter(Boolean);
}

export function normalizeRegionPerformance(payload) {
  const list = getData(payload, []);
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const i = /** @type {any} */ (item);
      return {
        regiaoId: String(i.regiaoId ?? ''),
        regiao: i.regiao ?? 'Sem região',
        totalPlacas: Number(i.totalPlacas ?? 0),
        placasAlugadas: Number(i.placasAlugadas ?? 0),
        taxaOcupacao: Number(i.taxaOcupacao ?? 0),
        receitaEstimada: Number(i.receitaEstimada ?? 0),
        propostasAbertas: Number(i.propostasAbertas ?? 0),
        contratosAtivos: Number(i.contratosAtivos ?? 0),
      };
    })
    .filter(Boolean);
}

export function normalizeSalesFunnel(payload) {
  const d = getData(payload, {});
  return {
    propostasCriadas: Number(d.propostasCriadas ?? 0),
    propostasEmNegociacao: Number(d.propostasEmNegociacao ?? 0),
    propostasAprovadas: Number(d.propostasAprovadas ?? 0),
    propostasRecusadas: Number(d.propostasRecusadas ?? 0),
    contratosGerados: Number(d.contratosGerados ?? 0),
    taxaConversao: Number(d.taxaConversao ?? 0),
  };
}

export function normalizeDashboardAlerts(payload) {
  const list = getData(payload, []);
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const i = /** @type {any} */ (item);
      return {
        id: String(i.id ?? ''),
        tipo: i.tipo ?? 'idle-board',
        titulo: i.titulo ?? 'Alerta',
        descricao: i.descricao ?? '',
        severidade: ['info', 'warning', 'critical'].includes(i.severidade) ? i.severidade : 'info',
        acaoSugerida: i.acaoSugerida ?? 'Sem ação sugerida',
      };
    })
    .filter(Boolean);
}
