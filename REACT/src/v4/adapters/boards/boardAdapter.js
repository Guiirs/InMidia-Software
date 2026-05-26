const DEFAULT_IMAGE_URL = '/assets/img/placeholder.png';
const DEFAULT_ACTIONS = ['Detalhes', 'Historico', 'Agenda'];

const STATUS_SET = new Set([
  'disponivel',
  'ocupada',
  'reservada',
  'manutencao',
  'indisponivel',
  'vencendo',
  'pendente'
]);

function asString(value) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntil(dateValue) {
  const target = parseDate(dateValue);
  if (!target) {
    return null;
  }

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function hasPendingState(placa) {
  return Boolean(
    placa?.pendente ||
    placa?.hasPending ||
    placa?.documentoPendente ||
    placa?.comPendencia ||
    asString(placa?.pendenciaStatus).toLowerCase() === 'pendente'
  );
}

function hasMaintenanceState(placa) {
  return Boolean(
    placa?.emManutencao ||
    placa?.manutencao ||
    asString(placa?.motivoIndisponibilidade).toLowerCase().includes('manut')
  );
}

function hasReservationState(placa) {
  return Boolean(
    placa?.aluguel_futuro ||
    placa?.reservaAtiva ||
    placa?.reservada ||
    asString(placa?.situacaoContrato).toLowerCase().includes('reserv')
  );
}

function hasOccupiedState(placa) {
  return Boolean(
    placa?.aluguel_ativo ||
    placa?.ocupada ||
    asString(placa?.situacaoContrato).toLowerCase().includes('ocup') ||
    asString(placa?.situacaoContrato).toLowerCase().includes('alugu')
  );
}

function hasUnavailableState(placa) {
  if (placa?.disponivel === false || placa?.ativa === false) {
    return true;
  }

  return Boolean(
    placa?.indisponivel ||
    placa?.bloqueada ||
    asString(placa?.situacao).toLowerCase().includes('indisp')
  );
}

function hasExpiringState(placa) {
  const days = daysUntil(
    placa?.aluguel_data_fim ||
    placa?.fimContrato ||
    placa?.contratoFim ||
    placa?.periodoFim
  );

  return days != null && days >= 0 && days <= 7;
}

function mapExplicitStatus(rawStatus) {
  const status = asString(rawStatus).toLowerCase();
  if (!status) {
    return null;
  }

  if (status.includes('pend')) return 'pendente';
  if (status.includes('manut')) return 'manutencao';
  if (status.includes('reserv')) return 'reservada';
  if (status.includes('ocup') || status.includes('alugu')) return 'ocupada';
  if (status.includes('venc')) return 'vencendo';
  if (status.includes('indisp')) return 'indisponivel';
  if (status.includes('disp')) return 'disponivel';

  return null;
}

export function getBoardOperationalStatus(placa = {}) {
  const explicit = mapExplicitStatus(
    placa?.statusOperacional ||
    placa?.status ||
    placa?.situacao ||
    placa?.estado
  );

  if (explicit && STATUS_SET.has(explicit)) {
    return explicit;
  }

  if (hasPendingState(placa)) {
    return 'pendente';
  }

  if (hasMaintenanceState(placa)) {
    return 'manutencao';
  }

  if (hasReservationState(placa)) {
    return 'reservada';
  }

  if (hasOccupiedState(placa)) {
    if (hasExpiringState(placa)) {
      return 'vencendo';
    }

    return 'ocupada';
  }

  if (hasUnavailableState(placa)) {
    return 'indisponivel';
  }

  if (hasExpiringState(placa)) {
    return 'vencendo';
  }

  return 'disponivel';
}

export function getBoardOccupancyState(placa = {}) {
  const status = getBoardOperationalStatus(placa);
  const rawOccupancy =
    asNumber(placa?.ocupacaoPercentual) ??
    asNumber(placa?.taxaOcupacao) ??
    asNumber(placa?.occupancy) ??
    asNumber(placa?.ocupacao);

  let occupancy = rawOccupancy;

  if (occupancy == null) {
    if (status === 'ocupada') occupancy = 92;
    else if (status === 'reservada') occupancy = 76;
    else if (status === 'vencendo') occupancy = 68;
    else if (status === 'pendente') occupancy = 45;
    else if (status === 'manutencao') occupancy = 0;
    else if (status === 'indisponivel') occupancy = 100;
    else occupancy = 20;
  }

  occupancy = clamp(Math.round(occupancy), 0, 100);

  const availabilityByStatus = {
    disponivel: 'Janela comercial disponivel',
    ocupada: 'Espaco ocupado no ciclo atual',
    reservada: 'Reserva ativa para o proximo ciclo',
    manutencao: 'Ativo em manutencao operacional',
    indisponivel: 'Ativo bloqueado para venda',
    vencendo: 'Contrato proximo do vencimento',
    pendente: 'Pendente de liberacao operacional'
  };

  return {
    occupancy,
    availabilityLabel: availabilityByStatus[status] || 'Estado nao mapeado'
  };
}

export function getBoardAlertState(placa = {}) {
  const status = getBoardOperationalStatus(placa);

  if (status === 'indisponivel') {
    return 'Ativo indisponivel para negociacao.';
  }

  if (status === 'reservada') {
    return 'Reserva ativa registrada para o proximo periodo.';
  }

  if (status === 'vencendo') {
    return 'Contrato em janela critica de renovacao.';
  }

  if (status === 'pendente') {
    return 'Pendencia operacional exige tratativa.';
  }

  return null;
}

export function formatBoardPrice(value) {
  const numeric = asNumber(value);
  if (numeric == null) {
    return 'Nao informado';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(numeric);
}

export function formatBoardPeriod(period) {
  if (!period) {
    return 'Sem periodo contratado';
  }

  if (typeof period === 'string') {
    const trimmed = period.trim();
    return trimmed || 'Sem periodo contratado';
  }

  const start =
    asString(period.start) ||
    asString(period.inicio) ||
    asString(period.from) ||
    asString(period.dataInicio);

  const end =
    asString(period.end) ||
    asString(period.fim) ||
    asString(period.to) ||
    asString(period.dataFim);

  if (start && end) {
    return `${start} - ${end}`;
  }

  if (start) {
    return `A partir de ${start}`;
  }

  if (end) {
    return `Ate ${end}`;
  }

  return 'Sem periodo contratado';
}

export function mapPlacaToBoardCard(placa = {}) {
  const status = getBoardOperationalStatus(placa);
  const { occupancy, availabilityLabel } = getBoardOccupancyState(placa);

  const region = asString(placa?.regiao?.nome) || asString(placa?.regiaoNome) || asString(placa?.regiao) || 'Sem regiao';

  const city =
    asString(placa?.cidade) ||
    asString(placa?.municipio) ||
    asString(placa?.cidadeNome) ||
    'Cidade nao informada';

  const location =
    asString(placa?.nomeDaRua) ||
    asString(placa?.localizacao) ||
    asString(placa?.endereco) ||
    'Localizacao nao informada';

  const periodLabel = formatBoardPeriod(
    placa?.periodo || {
      inicio: placa?.aluguel_data_inicio || placa?.inicioContrato,
      fim: placa?.aluguel_data_fim || placa?.fimContrato
    }
  );

  const board = {
    id: asString(placa?.id) || asString(placa?._id) || asString(placa?.codigo) || 'sem-id',
    code: asString(placa?.numero_placa) || asString(placa?.codigo) || 'SEM-CODIGO',
    name: asString(placa?.nome) || asString(placa?.titulo) || asString(placa?.numero_placa) || 'Placa sem identificacao',
    imageUrl: asString(placa?.imageUrl) || asString(placa?.imagem) || asString(placa?.foto) || DEFAULT_IMAGE_URL,
    location,
    city,
    region,
    status,
    occupancy,
    clientName: asString(placa?.cliente_nome) || asString(placa?.cliente?.nome) || '',
    periodLabel,
    priceLabel: formatBoardPrice(
      placa?.valorReferencia || placa?.preco || placa?.precoReferencia || placa?.valor
    ),
    alert: getBoardAlertState(placa),
    actions: Array.isArray(placa?.acoes) && placa.acoes.length > 0 ? placa.acoes : DEFAULT_ACTIONS
  };

  return {
    ...board,
    availabilityLabel
  };
}

export function mapPlacasToBoardCards(placas = []) {
  if (!Array.isArray(placas)) {
    return [];
  }

  return placas.map((placa) => mapPlacaToBoardCard(placa));
}
