/**
 * Adapter de Placa.
 *
 * Responsabilidade única: converter qualquer formato de resposta da API
 * para o contrato canônico PlacaCanonica.
 *
 * REGRA: nenhum componente ou service faz normalização de placa fora deste arquivo.
 */

import { normalizeBoardCoordinates } from '../v4-painel/integration/adapters/boardCoordinates.js';

/**
 * Converte um objeto de placa bruto (qualquer formato de API) para PlacaCanonica.
 * Trata os aliases legados: ativa → disponivel, regiao_id → regiaoId, id/_id.
 *
 * @param {unknown} raw
 * @returns {import('../contracts').PlacaCanonica | null}
 */
export function normalizePlaca(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const p = /** @type {any} */ (raw);

  // ID canônico
  const id = String(p.id ?? p._id ?? '');

  // Campo canônico de disponibilidade física.
  // Ordem: disponivel (campo real do DB) → ativa (alias legado) → true (fallback seguro)
  const disponivel = typeof p.disponivel === 'boolean'
    ? p.disponivel
    : typeof p.ativa === 'boolean'
      ? p.ativa
      : true;

  // Região normalizada
  const regiaoRaw = p.regiao ?? p.regiaoId;
  const regiao = typeof regiaoRaw === 'object' && regiaoRaw !== null
    ? {
        _id: String(regiaoRaw._id ?? regiaoRaw.id ?? ''),
        id: String(regiaoRaw.id ?? regiaoRaw._id ?? ''),
        nome: regiaoRaw.nome ?? 'Sem região',
      }
    : {
        _id: String(regiaoRaw ?? ''),
        id: String(regiaoRaw ?? ''),
        nome: p.regiao_nome ?? 'Sem região',
      };

  // Endereço canônico — consolida aliases legados
  const endereco = p.endereco ?? p.nomeDaRua ?? (typeof p.localizacao === 'string' ? p.localizacao : '');

  // Imagem canônica — consolida aliases legados
  const rawImages = Array.isArray(p.images) ? p.images : Array.isArray(p.imagens) ? p.imagens : [];
  const mainImage = p.mainImage
    ?? rawImages.find((image) => image?.isMain)
    ?? rawImages.find((image) => image?.category === 'MAIN')
    ?? null;
  const imagemPrincipal = p.mainImageUrl
    ?? p.imagemPrincipal
    ?? mainImage?.publicUrl
    ?? mainImage?.url
    ?? p.imagem
    ?? p.foto
    ?? p.imageUrl
    ?? p.fotoUrl
    ?? p.urlImagem
    ?? undefined;
  const coords = normalizeBoardCoordinates(p);

  return {
    id,
    _id: p._id ? String(p._id) : id,
    numero_placa: p.numero_placa ?? '',
    numeroOperacional: typeof p.numeroOperacional === 'number' ? p.numeroOperacional : undefined,
    disponivel,
    ativa: disponivel,
    // Endereço — canonical + legacy aliases
    endereco,
    nomeDaRua: endereco,
    localizacao: typeof p.localizacao === 'string' ? p.localizacao : endereco,
    // Coordenadas canônicas
    latitude: coords.hasCoordinates ? coords.latitude : undefined,
    longitude: coords.hasCoordinates ? coords.longitude : undefined,
    coordinates: coords.hasCoordinates ? { latitude: coords.latitude, longitude: coords.longitude } : p.coordinates,
    coordenadas: coords.hasCoordinates ? `${coords.latitude},${coords.longitude}` : (p.coordenadas ?? undefined),
    // Região
    regiao,
    regiaoId: regiao._id,
    regiao_nome: regiao.nome,
    regionalLot: p.regionalLot ?? p.loteRegional ?? '',
    loteRegional: p.loteRegional ?? p.regionalLot ?? '',
    // Status
    statusOperacional: p.statusOperacional ?? 'ACTIVE',
    statusComercial: p.statusComercial ?? 'AVAILABLE',
    // Mídia
    imagemPrincipal,
    mainImageUrl: imagemPrincipal ?? null,
    imagem: imagemPrincipal,
    imagens: rawImages.map((image, index) => ({
      id: image.id ?? image._id ?? image.key ?? `${id}-image-${index}`,
      _id: image._id ?? image.id,
      url: image.publicUrl ?? image.url ?? image.imageUrl ?? image.src ?? '',
      key: image.key ?? null,
      filename: image.filename ?? image.name ?? null,
      mimeType: image.mimeType ?? image.mimetype ?? null,
      size: image.size ?? null,
      category: image.category ?? 'OTHER',
      isMain: Boolean(image.isMain || image.category === 'MAIN' || image.publicUrl === imagemPrincipal || image.url === imagemPrincipal),
      source: image.source ?? 'UPLOAD',
      uploadedBy: image.uploadedBy ?? null,
      uploadedAt: image.uploadedAt ?? null,
      updatedAt: image.updatedAt ?? null,
      generatedBy: image.generatedBy ?? null,
      templateId: image.templateId ?? null,
      generationSource: image.generationSource ?? null,
      overlayData: image.overlayData ?? null,
      version: image.version ?? 1,
    })).filter((image) => image.url),
    images: rawImages.map((image, index) => ({
      id: image.id ?? image._id ?? image.key ?? `${id}-image-${index}`,
      url: image.publicUrl ?? image.url ?? image.imageUrl ?? image.src ?? '',
      filename: image.filename ?? image.name ?? null,
      category: image.category ?? 'OTHER',
      isMain: Boolean(image.isMain || image.category === 'MAIN' || image.publicUrl === imagemPrincipal || image.url === imagemPrincipal),
    })).filter((image) => image.url),
    imageStatus: imagemPrincipal ? 'AVAILABLE' : 'MISSING',
    // Dimensões / valor
    tipo: p.tipo ?? undefined,
    tamanho: p.tamanho ?? undefined,
    valor_mensal: typeof p.valor_mensal === 'number' ? p.valor_mensal : undefined,
    // Observações
    notes: p.notes ?? p.observacoes ?? '',
    observacoes: p.observacoes ?? p.notes ?? '',
    // Aluguel
    aluguel_ativo: Boolean(p.aluguel_ativo),
    aluguel_futuro: Boolean(p.aluguel_futuro),
    statusAluguel: p.statusAluguel ?? undefined,
    cliente_nome: p.cliente_nome ?? undefined,
    aluguel_data_inicio: p.aluguel_data_inicio ?? undefined,
    aluguel_data_fim: p.aluguel_data_fim ?? undefined,
    // Auditoria
    archivedAt: p.archivedAt ?? undefined,
  };
}

/**
 * Normaliza um array de placas.
 * @param {unknown[]} list
 * @returns {import('../contracts').PlacaCanonica[]}
 */
export function normalizePlacas(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizePlaca).filter(Boolean);
}

/**
 * Extrai arrays de respostas legadas ou envelopadas.
 *
 * @param {unknown} payload
 * @returns {unknown[]}
 */
export function extractArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const p = /** @type {any} */ (payload);
  if (Array.isArray(p.data)) return p.data;
  if (Array.isArray(p.data?.data)) return p.data.data;
  if (Array.isArray(p.locations)) return p.locations;
  if (Array.isArray(p.data?.locations)) return p.data.locations;
  if (Array.isArray(p.items)) return p.items;

  return [];
}

/**
 * Normaliza localizacao de placa para o contrato usado pelo mapa.
 *
 * @param {unknown} raw
 * @returns {object | null}
 */
export function normalizePlacaLocation(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const loc = /** @type {any} */ (raw);
  const id = String(loc.id ?? loc._id ?? loc.placaId ?? '');
  if (!id) return null;

  const coords = normalizeBoardCoordinates(loc);
  const latitude = coords.latitude;
  const longitude = coords.longitude;
  const coordenadas = coords.hasCoordinates ? `${latitude},${longitude}` : '';

  return {
    ...loc,
    id,
    _id: loc._id ? String(loc._id) : id,
    coordenadas,
    latitude,
    longitude,
  };
}

/**
 * Normaliza resposta de GET /placas/locations.
 *
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizePlacaLocationsPayload(payload) {
  return extractArrayPayload(payload).map(normalizePlacaLocation).filter(Boolean);
}

/**
 * Normaliza o payload paginado retornado por GET /placas.
 * Aceita tanto `{ data: [], pagination: {} }` quanto array simples.
 *
 * @param {unknown} payload
 * @returns {{ data: import('../contracts').PlacaCanonica[], pagination: import('../contracts').PaginacaoCanonica }}
 */
export function normalizePlacasPayload(payload) {
  const emptyPagination = { totalDocs: 0, totalPages: 1, currentPage: 1, limit: 10, hasNextPage: false, hasPrevPage: false };

  if (!payload) return { data: [], pagination: emptyPagination };

  if (Array.isArray(payload)) {
    return { data: normalizePlacas(payload), pagination: emptyPagination };
  }

  const p = /** @type {any} */ (payload);

  if (Array.isArray(p.data)) {
    return {
      data: normalizePlacas(p.data),
      pagination: {
        totalDocs: p.pagination?.totalDocs ?? p.total ?? p.data.length,
        totalPages: p.pagination?.totalPages ?? 1,
        currentPage: p.pagination?.currentPage ?? p.page ?? 1,
        limit: p.pagination?.limit ?? p.limit ?? 10,
        hasNextPage: p.pagination?.hasNextPage ?? false,
        hasPrevPage: p.pagination?.hasPrevPage ?? false,
      },
    };
  }

  // Payload é um único objeto de placa
  const normalized = normalizePlaca(p.data ?? p);
  return {
    data: normalized ? [normalized] : [],
    pagination: emptyPagination,
  };
}
