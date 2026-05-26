/**
 * boardAdapter.js — v4-painel
 *
 * Transforma PlacaCanonica (formato da API real) para Board (formato operacional v4-painel).
 * Nunca quebra se campos vierem nulos — usa fallback ou derivação.
 *
 * Fluxo: placaService → normalizePlaca (placaAdapter) → normalizeBoard (aqui) → InventoryPage
 */

import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { PRIORITY }          from '../../foundation/priorities.js';
import { SEVERITY }          from '../../foundation/severityLevels.js';
import { getImageUrl }       from '../../../utils/helpers.js';
import { normalizeBoardCoordinates } from './boardCoordinates.js';

const BOARD_STATUS = {
  OCCUPIED: 'occupied',
  AVAILABLE: 'available',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
  CRITICAL: 'critical',
};

/* ── Mapas de derivação ─────────────────────────────────────── */

const REGIAO_TO_SIGLA = {
  'São Paulo':         'SP',
  'Rio de Janeiro':    'RJ',
  'Minas Gerais':      'MG',
  'Rio Grande do Sul': 'RS',
  'Paraná':            'PR',
  'Bahia':             'BA',
  'Santa Catarina':    'SC',
  'Pernambuco':        'PE',
  'Ceará':             'CE',
  'Goiás':             'GO',
  'Espírito Santo':    'ES',
  'Mato Grosso':       'MT',
  'Mato Grosso do Sul':'MS',
};

const STATUS_TO_ESTADO = {
  [BOARD_STATUS.OCCUPIED]:    OPERATIONAL_STATE.HEALTHY,
  [BOARD_STATUS.AVAILABLE]:   OPERATIONAL_STATE.WARNING,
  [BOARD_STATUS.MAINTENANCE]: OPERATIONAL_STATE.DEGRADED,
  [BOARD_STATUS.RESERVED]:    OPERATIONAL_STATE.WARNING,
  [BOARD_STATUS.CRITICAL]:    OPERATIONAL_STATE.CRITICAL,
};

/* ── Derivadores ────────────────────────────────────────────── */

function deriveStatus(placa) {
  if (placa.aluguel_ativo)  return BOARD_STATUS.OCCUPIED;
  if (placa.aluguel_futuro) return BOARD_STATUS.RESERVED;
  if (!placa.disponivel)    return BOARD_STATUS.MAINTENANCE;
  return BOARD_STATUS.AVAILABLE;
}

function derivePriority(receita, diasOcioso, status) {
  if (status === BOARD_STATUS.CRITICAL || status === BOARD_STATUS.MAINTENANCE) return PRIORITY.URGENT;
  if (diasOcioso != null && diasOcioso > 14) return PRIORITY.HIGH;
  if (receita > 4000) return PRIORITY.HIGH;
  return PRIORITY.NORMAL;
}

function deriveRisk(status, diasOcioso) {
  if (status === BOARD_STATUS.CRITICAL)    return SEVERITY.CRITICAL;
  if (status === BOARD_STATUS.MAINTENANCE) return SEVERITY.HIGH;
  if (status === BOARD_STATUS.RESERVED)    return SEVERITY.HIGH;
  if (diasOcioso != null && diasOcioso > 21) return SEVERITY.MEDIUM;
  if (diasOcioso != null && diasOcioso > 7)  return SEVERITY.LOW;
  return SEVERITY.INFO;
}

function deriveStatusDetalhe(status, placa, diasOcioso) {
  if (status === BOARD_STATUS.CRITICAL)    return 'Sem comunicação — verificação em campo necessária.';
  if (status === BOARD_STATUS.MAINTENANCE) return 'Placa em manutenção. Retorno previsto em breve.';
  if (status === BOARD_STATUS.OCCUPIED)    return `Ativo. Campanha em veiculação${placa.cliente_nome ? ` — ${placa.cliente_nome}` : ''}.`;
  if (status === BOARD_STATUS.RESERVED)    return 'Reservada. Aguardando início de campanha.';
  if (diasOcioso != null && diasOcioso > 0) return `Disponível há ${diasOcioso} dia${diasOcioso !== 1 ? 's' : ''}. Aguardando nova campanha.`;
  return 'Disponível para nova campanha.';
}

function deriveRecomendacao(status, diasOcioso) {
  if (status === BOARD_STATUS.CRITICAL)    return 'Verificar equipamento em campo imediatamente.';
  if (status === BOARD_STATUS.MAINTENANCE) return 'Aguardar conclusão da manutenção antes de prospectar.';
  if (status === BOARD_STATUS.RESERVED)    return 'Confirmar renovação de contrato com o cliente.';
  if (status === BOARD_STATUS.OCCUPIED)    return 'Iniciar negociação de renovação com antecedência.';
  if (diasOcioso != null && diasOcioso > 14) return 'Posição ociosa há mais de 14 dias — acionar carteira de leads com urgência.';
  return 'Acionar carteira de leads para comercializar esta posição.';
}

function formatCurrency(value) {
  if (!value || value <= 0) return 'A negociar';
  return `R$ ${value.toLocaleString('pt-BR')}/mês`;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

function rawGalleryImages(input) {
  return Array.isArray(input?.images) ? input.images : Array.isArray(input?.imagens) ? input.imagens : [];
}

function resolveRawMainImage(placa) {
  const images = rawGalleryImages(placa);
  const mainImage = placa.mainImage
    ?? images.find((image) => image?.isMain)
    ?? images.find((image) => image?.category === 'MAIN')
    ?? null;
  return placa.mainImageUrl
    ?? placa.imagemPrincipal
    ?? mainImage?.publicUrl
    ?? mainImage?.url
    ?? placa.imagem
    ?? placa.foto
    ?? placa.imageUrl
    ?? placa.fotoUrl
    ?? placa.urlImagem
    ?? null;
}

function normalizeImageUrl(placa, fallback) {
  const rawImage = resolveRawMainImage(placa);
  if (!rawImage) return fallback?.imageUrl ?? null;
  if (typeof rawImage !== 'string') return fallback?.imageUrl ?? null;
  if (rawImage.startsWith('blob:') || rawImage.startsWith('data:')) return rawImage;
  return getImageUrl(rawImage, fallback?.imageUrl ?? '/assets/img/placeholder.png');
}

function normalizeGalleryImageUrl(imageUrl, fallbackUrl = '/assets/img/placeholder.png') {
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) return '';
  return getImageUrl(imageUrl, fallbackUrl);
}

/* ── Normalizador principal ─────────────────────────────────── */

/**
 * Converte uma PlacaCanonica para o formato Board v4-painel.
 *
 * @param {Object} placa       - PlacaCanonica (saída de normalizePlaca)
 * @param {Object} [fallback]  - Board mock de fallback para campos ausentes na API
 * @returns {Object}           Board normalizado para uso no v4-painel
 */
export function normalizeBoard(placa, fallback = null) {
  const status      = deriveStatus(placa);
  const ocupado     = placa.aluguel_ativo;
  const coords      = normalizeBoardCoordinates(placa);
  const fallbackCoords = coords.hasCoordinates ? null : normalizeBoardCoordinates(fallback ?? {});
  const regiao      = placa.regiao_nome ?? placa.regiao?.nome ?? fallback?.regiao ?? 'Sem região';
  const siglaRegiao = REGIAO_TO_SIGLA[regiao] ?? fallback?.siglaRegiao ?? '??';
  const receita     = typeof placa.valor_mensal === 'number' ? placa.valor_mensal : (fallback?.receitaEstimada ?? 0);
  const diasOcioso  = ocupado ? null : daysSince(placa.aluguel_data_fim) ?? fallback?.diasOcioso ?? null;
  const estado      = STATUS_TO_ESTADO[status] ?? OPERATIONAL_STATE.PENDING;
  const codigo      = placa.numero_placa || fallback?.codigo || placa.id;
  const endereco    = placa.endereco || placa.nomeDaRua || (typeof placa.localizacao === 'string' ? placa.localizacao : '') || fallback?.endereco || fallback?.localizacao || '';
  const nome        = placa.nomeDaRua || endereco || fallback?.nome || codigo;
  const localizacao = (typeof placa.localizacao === 'string' ? placa.localizacao : '') || endereco || fallback?.localizacao || nome;
  const latitude    = coords.latitude ?? fallbackCoords?.latitude ?? null;
  const longitude   = coords.longitude ?? fallbackCoords?.longitude ?? null;
  const hasCoordinates = latitude != null && longitude != null;
  const rawImages = rawGalleryImages(placa);
  const imagemPrincipal = resolveRawMainImage(placa);
  const mainImageUrl = normalizeImageUrl(placa, fallback);
  const imagens = rawImages.map((image, index) => {
    const rawUrl = image.url ?? image.imageUrl ?? image.src ?? '';
    return {
      id: image.id ?? image._id ?? image.key ?? `${placa.id ?? codigo}-image-${index}`,
      _id: image._id ?? image.id,
      url: normalizeGalleryImageUrl(rawUrl, fallback?.imageUrl ?? '/assets/img/placeholder.png'),
      rawUrl,
      key: image.key ?? null,
      filename: image.filename ?? image.name ?? null,
      mimeType: image.mimeType ?? image.mimetype ?? null,
      size: image.size ?? null,
      category: image.category ?? 'OTHER',
      isMain: Boolean(image.isMain || image.category === 'MAIN' || rawUrl === imagemPrincipal || image.url === imagemPrincipal),
      source: image.source ?? 'UPLOAD',
      uploadedBy: image.uploadedBy ?? null,
      uploadedAt: image.uploadedAt ?? null,
      updatedAt: image.updatedAt ?? null,
      generatedBy: image.generatedBy ?? null,
      templateId: image.templateId ?? null,
      generationSource: image.generationSource ?? null,
      overlayData: image.overlayData ?? null,
      version: image.version ?? 1,
    };
  }).filter((image) => image.url);

  return {
    /* ─ Identidade ─────────────────────────────────────────── */
    id:               placa.id,
    codigo,
    nome,
    localizacao,
    endereco,
    nomeDaRua:        placa.nomeDaRua ?? endereco,

    /* ─ Localização ─────────────────────────────────────────── */
    regiao,
    siglaRegiao,
    /* regiaoId é o ObjectId MongoDB — necessário para PUT /placas/:id */
    regiaoId:         placa.regiaoId ?? placa.regionId ?? placa.regiao?._id ?? placa.regiao?.id ?? null,
    regionId:         placa.regionId ?? placa.regiaoId ?? placa.regiao?._id ?? placa.regiao?.id ?? null,
    regionalLot:      placa.regionalLot ?? placa.loteRegional ?? fallback?.regionalLot ?? '',
    loteRegional:     placa.loteRegional ?? placa.regionalLot ?? fallback?.loteRegional ?? '',
    lat:              latitude,
    lng:              longitude,
    latitude,
    longitude,
    coordinates:      hasCoordinates ? { latitude, longitude } : (placa.coordinates ?? null),
    coordenadas:      hasCoordinates ? `${latitude},${longitude}` : (placa.coordenadas ?? null),
    hasCoordinates,
    coordinateSource: coords.source ?? fallbackCoords?.source ?? null,

    /* ─ Status operacional ──────────────────────────────────── */
    status,
    statusOperacional: placa.statusOperacional ?? fallback?.statusOperacional ?? null,
    estado,
    ocupacao:         ocupado ? 1 : 0,
    ocupado:          Boolean(ocupado),

    /* ─ Categorização ───────────────────────────────────────── */
    categoria:        placa.tipo ?? fallback?.categoria ?? 'Standard B',
    tamanho:          placa.tamanho ?? fallback?.tamanho ?? '',

    /* ─ Receita ─────────────────────────────────────────────── */
    receitaEstimada:  receita,
    receitaFormatada: formatCurrency(receita),

    /* ─ Prioridade e risco ──────────────────────────────────── */
    prioridade:       derivePriority(receita, diasOcioso, status),
    risco:            deriveRisk(status, diasOcioso),

    /* ─ Temporalidade ───────────────────────────────────────── */
    diasOcioso,
    vencimento:       placa.aluguel_data_fim ?? fallback?.vencimento ?? null,
    ultimaAtividade:  fallback?.ultimaAtividade ?? (ocupado ? 'Ativo' : 'Livre'),

    /* ─ Comercial ───────────────────────────────────────────── */
    campanha:         fallback?.campanha ?? null, // API não expõe campanha ainda
    cliente:          placa.cliente_nome ?? fallback?.cliente ?? null,

    /* ─ Textos operacionais ─────────────────────────────────── */
    statusDetalhe:    deriveStatusDetalhe(status, placa, diasOcioso),
    recomendacao:     deriveRecomendacao(status, diasOcioso),
    visibilidade:     fallback?.visibilidade ?? 'Não informado',

    /* ─ Mídia ───────────────────────────────────────────────── */
    imageUrl:         mainImageUrl,
    mainImageUrl,
    imagemPrincipal,
    imagem:           placa.imagem ?? imagemPrincipal,
    images:           imagens.length ? imagens : (fallback?.images ?? fallback?.imagens ?? []),
    imagens:          imagens.length ? imagens : (fallback?.imagens ?? []),
    imageStatus:      mainImageUrl ? 'AVAILABLE' : 'MISSING',
    thumbnailUrl:     fallback?.thumbnailUrl ?? null,
    imageAlt:         fallback?.imageAlt ?? `Placa ${codigo}`,
    notes:            placa.notes ?? placa.observacoes ?? fallback?.notes ?? '',
    observacoes:      placa.observacoes ?? placa.notes ?? fallback?.observacoes ?? '',
    archivedAt:       placa.archivedAt ?? null,

    /* ─ Metadado de origem ──────────────────────────────────── */
    _source: 'real',
  };
}

/**
 * Normaliza uma lista de PlacaCanonica.
 *
 * @param {Object[]} placas
 * @param {Object}   [fallbackMap] - { [codigo]: Board } lookup de fallback por numero_placa
 * @returns {Object[]}
 */
export function normalizeBoards(placas, fallbackMap = {}) {
  if (!Array.isArray(placas)) return [];
  return placas.map(p => normalizeBoard(p, fallbackMap[p.numero_placa] ?? null));
}

/* ── Conversores de Board v4 → API ──────────────────────────── */

/**
 * Converte um Board v4-painel em FormData para PUT /placas/:id.
 *
 * Regras:
 * - Só envia campos que a API aceita (numero_placa, nomeDaRua, coordenadas, regiaoId)
 * - Campos derivados/mockados do v4 (prioridade, risco, visibilidade, etc.) são ignorados
 * - imagem é enviada apenas quando há File object em `imageFile`
 * - regiaoId só é enviado se for um ObjectId MongoDB válido (24 hex chars)
 * - coordenadas só são enviadas se lat e lng forem números válidos
 *
 * @param {Object} board - Board v4-painel editado
 * @returns {FormData}
 */
export function toBoardUpdateFormData(board) {
  const fd = new FormData();

  /* numero_placa e nomeDaRua: só envia strings não-vazias */
  const codigo = typeof board.codigo === 'string' ? board.codigo.trim() : '';
  const localizacao = typeof board.localizacao === 'string' ? board.localizacao.trim() : '';
  if (codigo)      fd.append('numero_placa', codigo);
  if (localizacao) fd.append('nomeDaRua', localizacao);

  /* Coordenadas: apenas se ambos forem números válidos */
  const coords = normalizeBoardCoordinates(board);
  if (coords.hasCoordinates) {
    fd.append('latitude', String(coords.latitude));
    fd.append('longitude', String(coords.longitude));
    fd.append('coordenadas', `${coords.latitude},${coords.longitude}`);
  }

  /* regiaoId: apenas se for ObjectId válido (não envia nomes de região).
     Se ausente/inválido, o backend mantém o valor existente (campo opcional no PUT). */
  if (board.regiaoId && /^[0-9a-f]{24}$/i.test(String(board.regiaoId))) {
    fd.append('regiaoId', board.regiaoId);
  } else if (import.meta.env.DEV && board._source === 'real') {
    console.warn('[boardAdapter] regiaoId ausente ou inválido — omitido do FormData.', {
      regiaoId: board.regiaoId,
      boardId: board.id,
      codigo: board.codigo,
    });
  }

  if (typeof File !== 'undefined' && board.imageFile instanceof File) {
    fd.append('imagem', board.imageFile);
  }

  /* campanha, prioridade, risco, categoria, visibilidade: campos v4 ignorados */

  return fd;
}
