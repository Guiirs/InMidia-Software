/**
 * normalizePlateCardData.js
 *
 * Contrato seguro entre o boardAdapter e o BoardOperationalCard.
 *
 * Responsabilidades:
 *  - Garantir fallback para todos os campos textuais exibidos no card
 *  - Expor apenas `imageUrl` como campo de imagem (sem imagemPrincipal, imagem,
 *    storageKey ou qualquer chave R2 crua)
 *  - Validar o status operacional para um dos valores conhecidos
 *  - Nunca lançar exceção com entrada nula, incompleta ou corrompida
 *
 * Uso:
 *   import { normalizePlateCardData } from './normalizePlateCardData.js';
 *   const card = normalizePlateCardData(boardFromAdapter);
 *   // card.imageUrl — única fonte de imagem para o card
 *   // card.status  — sempre um dos valores conhecidos + 'unknown'
 */

const KNOWN_STATUSES = new Set(['available', 'occupied', 'reserved', 'maintenance', 'critical']);

function str(value, fallback = '') {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function num(value) {
  return typeof value === 'number' && isFinite(value) ? value : null;
}

function isLoadableUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:')   ||
    url.startsWith('data:')   ||
    url.startsWith('/')
  );
}

/**
 * Resolve a URL de imagem segura de um board, priorizando campos normalizados.
 * Rejeita keys R2 cruas e campos legados (imagemPrincipal, imagem, foto).
 * Seguro com null/undefined.
 *
 * @param {Object|null|undefined} board
 * @returns {string|null}
 */
export function resolveSafePlateImageUrl(board) {
  if (!board) return null;
  const url =
    (typeof board.imageUrl === 'string' && board.imageUrl.trim())
      ? board.imageUrl.trim()
      : (typeof board.mainImageUrl === 'string' && board.mainImageUrl.trim())
        ? board.mainImageUrl.trim()
        : (typeof board.media?.mainUrl === 'string' && board.media.mainUrl.trim())
          ? board.media.mainUrl.trim()
          : null;
  if (!url) return null;
  return isLoadableUrl(url) ? url : null;
}

/**
 * @param {Object} raw  Board normalizado pelo boardAdapter (ou placa raw da API)
 * @returns {PlateCardData}  Contrato seguro para consumo exclusivo pelo BoardOperationalCard
 */
export function normalizePlateCardData(input = {}) {
  const raw = input ?? {};
  // ── Identidade ───────────────────────────────────────────────────────────────
  const id     = str(raw.id ?? raw._id, 'unknown');
  const codigo = str(raw.codigo ?? raw.numero_placa, '—');
  const nome   = str(raw.nome ?? raw.codigo ?? raw.numero_placa, 'Sem nome');

  // ── Localização ──────────────────────────────────────────────────────────────
  const localizacao = str(raw.localizacao ?? raw.endereco ?? raw.nomeDaRua, 'Localização não informada');
  const regiao      = str(raw.regiao, 'Sem região');
  const siglaRegiao = str(raw.siglaRegiao, '??');

  const latitude    = num(raw.latitude  ?? raw.lat);
  const longitude   = num(raw.longitude ?? raw.lng);
  const hasCoordinates = latitude !== null && longitude !== null;

  // ── Status ────────────────────────────────────────────────────────────────────
  const status = KNOWN_STATUSES.has(raw.status) ? raw.status : 'unknown';
  const estado = str(raw.estado, 'pending');

  // ── Categorização ─────────────────────────────────────────────────────────────
  const categoria = str(raw.categoria, 'Standard');
  const tamanho   = str(raw.tamanho, '');
  const medidas   = raw.medidas ?? raw.tamanho ?? null;

  // ── Imagem — ÚNICO campo de imagem exposto para o card ────────────────────────
  // Campos legados (imagemPrincipal, imagem, foto, storageKey) são resolvidos
  // ANTES pelo boardAdapter e resultam em `imageUrl`. O card nunca os vê.
  // imagemUrl (sem P) é campo legado da API de listagem — normalizado aqui.
  const rawImageUrl =
    (typeof raw.imageUrl        === 'string' && raw.imageUrl.trim())        ? raw.imageUrl.trim()        :
    (typeof raw.imagemUrl       === 'string' && raw.imagemUrl.trim())       ? raw.imagemUrl.trim()       :
    (typeof raw.mainImageUrl    === 'string' && raw.mainImageUrl.trim())    ? raw.mainImageUrl.trim()    :
    (typeof raw.media?.mainUrl  === 'string' && raw.media.mainUrl.trim())   ? raw.media.mainUrl.trim()   :
    null;

  const imageUrl        = rawImageUrl;
  const hasImage        = imageUrl !== null;
  const isValidImageUrl = hasImage && isLoadableUrl(imageUrl);

  // ── Comercial ─────────────────────────────────────────────────────────────────
  const cliente    = raw.cliente   != null  ? String(raw.cliente)    : null;
  const campanha   = raw.campanha  != null  ? String(raw.campanha)   : null;
  const vencimento = raw.vencimento != null ? String(raw.vencimento) : null;
  // CP snapshot — passthrough somente leitura; nunca persiste em placa
  const commercialSnapshot = (raw.commercialSnapshot != null && typeof raw.commercialSnapshot === 'object')
    ? raw.commercialSnapshot
    : null;

  // ── Bloqueio operacional (instalação/raspagem/manutenção/bloqueio manual) ──
  const rawOperationalBlock = (raw.operationalBlock != null && typeof raw.operationalBlock === 'object')
    ? raw.operationalBlock
    : null;
  const operationalBlock = rawOperationalBlock && rawOperationalBlock.blocked !== false ? {
    blocked:         true,
    reason:          str(rawOperationalBlock.reason, 'Esta placa já possui uma operação em aberto.'),
    operationId:     str(rawOperationalBlock.operationId, ''),
    operationType:   str(rawOperationalBlock.operationType, 'OTHER'),
    operationStatus: str(rawOperationalBlock.operationStatus ?? rawOperationalBlock.status, 'PENDING'),
    status:          str(rawOperationalBlock.status ?? rawOperationalBlock.operationStatus, 'PENDING'),
    label:           str(rawOperationalBlock.label, 'Operação em andamento'),
    assignedTo:      rawOperationalBlock.assignedTo != null ? String(rawOperationalBlock.assignedTo) : null,
    notes:           rawOperationalBlock.notes != null ? String(rawOperationalBlock.notes) : null,
    teamSnapshot:    (rawOperationalBlock.teamSnapshot != null && typeof rawOperationalBlock.teamSnapshot === 'object')
      ? rawOperationalBlock.teamSnapshot
      : null,
  } : null;
  const isAllocationBlocked = Boolean(operationalBlock);

  // ── Operacional ───────────────────────────────────────────────────────────────
  const prioridade       = str(raw.prioridade,       'normal');
  const risco            = str(raw.risco,            'info');
  const diasOcioso       = num(raw.diasOcioso);
  const receitaEstimada  = num(raw.receitaEstimada) ?? 0;
  const receitaFormatada = str(raw.receitaFormatada, 'A negociar');
  const recomendacao     = str(raw.recomendacao,     '');
  const statusDetalhe    = str(raw.statusDetalhe,    '');
  const visibilidade     = str(raw.visibilidade,     'Não informado');
  const ocupado          = Boolean(raw.ocupado);
  const ocupacao         = num(raw.ocupacao) ?? 0;

  // ── Galeria (passthrough para PlateImageManager — não usada diretamente pelo card) ──
  const images  = Array.isArray(raw.images)  ? raw.images  : [];
  const imagens = Array.isArray(raw.imagens) ? raw.imagens : [];

  return {
    // Identidade
    id,
    codigo,
    nome,
    titulo: nome,

    // Localização
    localizacao,
    regiao,
    siglaRegiao,
    endereco:        raw.endereco        ?? localizacao,
    nomeDaRua:       raw.nomeDaRua       ?? localizacao,
    latitude,
    longitude,
    lat:             latitude,
    lng:             longitude,
    hasCoordinates,
    coordinates:     hasCoordinates ? { latitude, longitude } : (raw.coordinates ?? null),
    coordenadas:     hasCoordinates ? `${latitude},${longitude}` : (raw.coordenadas ?? null),
    coordinateSource: raw.coordinateSource ?? null,

    // Status
    status,
    estado,
    statusOperacional: raw.statusOperacional ?? null,

    // Categorização
    categoria,
    tamanho,
    medidas,

    // Imagem — os únicos campos de imagem que o card deve conhecer
    imageUrl,
    hasImage,
    isValidImageUrl,
    imageStatus: hasImage ? 'AVAILABLE' : 'MISSING',

    // Comercial
    cliente,
    campanha,
    vencimento,
    commercialSnapshot,

    // Bloqueio operacional
    operationalBlock,
    isAllocationBlocked,

    // Operacional
    prioridade,
    risco,
    diasOcioso,
    receitaEstimada,
    receitaFormatada,
    recomendacao,
    statusDetalhe,
    visibilidade,
    ocupado,
    ocupacao,

    // Galeria (passthrough)
    images,
    imagens,

    // Observações
    notes:       raw.notes       ?? raw.observacoes ?? '',
    observacoes: raw.observacoes ?? raw.notes       ?? '',
    archivedAt:  raw.archivedAt  ?? null,

    // IDs relacionais (para edição)
    regiaoId:  raw.regiaoId  ?? raw.regionId  ?? null,
    regionId:  raw.regionId  ?? raw.regiaoId  ?? null,

    // Metadado de origem
    _source: raw._source ?? 'real',
  };
}
