import { normalizeBoard, normalizeBoards } from '../v4-painel/integration/adapters/boardAdapter.js';
import { normalizeBoardCoordinates } from '../v4-painel/integration/adapters/boardCoordinates.js';
import { normalizeInventorySummary } from '../v4-painel/integration/adapters/inventorySummaryAdapter.js';
import { getInventoryBoardsQuery } from '../core/sync-core/query/inventoryBoardQuery.js';
import { ensureNoProductionMock, requestFirstAvailable, requestV4, v1Base } from './v4ServiceUtils.js';

function dataList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.boards)) return payload.boards;
  if (Array.isArray(payload?.data?.boards)) return payload.data.boards;
  return [];
}

function boardToCanonical(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const regiao = raw.regiao && typeof raw.regiao === 'object'
    ? { _id: raw.regiao.id ?? raw.regiao._id ?? '', id: raw.regiao.id ?? raw.regiao._id ?? '', nome: raw.regiao.nome ?? 'Sem regiao' }
    : { _id: '', id: '', nome: 'Sem regiao' };
  const active = raw.aluguelAtivo ?? null;
  const coords = normalizeBoardCoordinates(raw);
  const endereco = raw.endereco ?? raw.nomeDaRua ?? (typeof raw.localizacao === 'string' ? raw.localizacao : '');
  const rawImages = Array.isArray(raw.images) ? raw.images : Array.isArray(raw.imagens) ? raw.imagens : [];
  const mainImage = raw.mainImage
    ?? rawImages.find((image) => image?.isMain)
    ?? rawImages.find((image) => image?.category === 'MAIN')
    ?? null;
  const imagemPrincipal = raw.mainImageUrl
    ?? raw.imagemPrincipal
    ?? mainImage?.publicUrl
    ?? mainImage?.url
    ?? raw.imagem
    ?? raw.foto
    ?? raw.imageUrl
    ?? null;
  const imageStatus = imagemPrincipal ? 'AVAILABLE' : 'MISSING';

  return {
    id: raw.id ?? raw._id,
    _id: raw._id ?? raw.id,
    numero_placa: raw.codigo ?? raw.numero_placa,
    disponivel: Boolean(raw.disponivel),
    ativa: Boolean(raw.disponivel),
    endereco,
    nomeDaRua: raw.nomeDaRua ?? endereco,
    localizacao: typeof raw.localizacao === 'string' ? raw.localizacao : endereco,
    latitude: coords.latitude,
    longitude: coords.longitude,
    coordinates: raw.coordinates ?? (coords.hasCoordinates ? { latitude: coords.latitude, longitude: coords.longitude } : undefined),
    coordenadas: raw.coordenadas ?? (coords.hasCoordinates ? `${coords.latitude},${coords.longitude}` : ''),
    hasCoordinates: coords.hasCoordinates,
    coordinateSource: coords.source,
    tamanho: raw.tamanho ?? '',
    tipo: raw.tipo ?? raw.categoria ?? '',
    regiao,
    regiaoId: raw.regiaoId ?? raw.regionId ?? regiao.id,
    regionId: raw.regionId ?? raw.regiaoId ?? regiao.id,
    regiao_nome: regiao.nome,
    imagem: raw.imagem ?? imagemPrincipal,
    imagemPrincipal,
    mainImageUrl: imagemPrincipal,
    imageStatus,
    imagens: rawImages.map((image, index) => ({
      id: image.id ?? image._id ?? image.key ?? `${raw.id ?? raw._id ?? raw.codigo ?? 'image'}-${index}`,
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
      id: image.id ?? image._id ?? image.key ?? `${raw.id ?? raw._id ?? raw.codigo ?? 'image'}-${index}`,
      _id: image._id ?? image.id,
      url: image.publicUrl ?? image.url ?? image.imageUrl ?? image.src ?? '',
      filename: image.filename ?? image.name ?? null,
      category: image.category ?? 'OTHER',
      isMain: Boolean(image.isMain || image.category === 'MAIN' || image.publicUrl === imagemPrincipal || image.url === imagemPrincipal),
      source: image.source ?? 'UPLOAD',
      uploadedAt: image.uploadedAt ?? null,
      updatedAt: image.updatedAt ?? null,
    })).filter((image) => image.url),
    statusOperacional: raw.statusOperacional ?? null,
    regionalLot: raw.regionalLot ?? raw.loteRegional ?? '',
    loteRegional: raw.loteRegional ?? raw.regionalLot ?? '',
    notes: raw.notes ?? raw.observacoes ?? '',
    observacoes: raw.observacoes ?? raw.notes ?? '',
    archivedAt: raw.archivedAt ?? null,
    commercialStatus: raw.commercialStatus ?? undefined,
    temporalStatus: raw.commercialStatus ?? undefined,
    aluguel_data_inicio: active?.startDate ?? undefined,
    aluguel_data_fim: active?.endDate ?? undefined,
  };
}

function boardPayloadFromUi(board = {}) {
  const payload = {};
  if (typeof board.codigo === 'string') payload.numero_placa = board.codigo;
  // Endereço — canonical + legacy alias
  if (typeof board.endereco === 'string') payload.endereco = board.endereco;
  if (typeof board.localizacao === 'string') payload.nomeDaRua = board.localizacao;
  // Coordenadas — prefer individual lat/lng, fallback to pre-built string
  const coords = normalizeBoardCoordinates(board);
  if (coords.hasCoordinates) {
    payload.latitude = coords.latitude;
    payload.longitude = coords.longitude;
    payload.coordinates = { latitude: coords.latitude, longitude: coords.longitude };
    payload.coordenadas = `${coords.latitude},${coords.longitude}`;
  }
  if (typeof board.regiaoId === 'string') payload.regiaoId = board.regiaoId;
  if (typeof board.regionalLot === 'string' && board.regionalLot) payload.regionalLot = board.regionalLot;
  if (typeof board.imageUrl === 'string' && !board.imageUrl.startsWith('blob:')) payload.imageUrl = board.imageUrl;
  if (typeof board.statusOperacional === 'string') payload.statusOperacional = board.statusOperacional;
  if (typeof board.tamanho === 'string') payload.tamanho = board.tamanho;
  if (typeof board.notes === 'string') payload.notes = board.notes;
  return payload;
}

function normalizeBoardPayload(payload) {
  const raw = payload?.board ?? payload;
  const canonical = boardToCanonical(raw);
  if (!canonical) throw new Error('Resposta invalida do inventario V4.');
  return normalizeBoard(canonical);
}

function normalizeRegionPayload(payload) {
  const rawRegions = Array.isArray(payload?.regions) ? payload.regions : [];
  return {
    regions: rawRegions.map((region) => ({
      id: region.id ?? region.name ?? 'sem-regiao',
      name: region.name ?? 'Sem regiao',
      code: region.code ?? null,
      totalBoards: Number(region.totalBoards ?? 0),
      availableBoards: Number(region.availableBoards ?? 0),
      occupiedBoards: Number(region.occupiedBoards ?? 0),
      reservedBoards: Number(region.reservedBoards ?? 0),
      maintenanceBoards: Number(region.maintenanceBoards ?? 0),
      criticalBoards: Number(region.criticalBoards ?? 0),
      occupancyRate: Number(region.occupancyRate ?? 0),
      boards: normalizeBoards(dataList({ boards: region.boards }).map(boardToCanonical).filter(Boolean)),
    })),
    total: Number(payload?.total ?? rawRegions.length),
  };
}

export async function listBoards(options = {}) {
  const query = { ...getInventoryBoardsQuery(), ...options };
  const params = {
    page: query.page ?? 1,
    limit: query.limit ?? 200,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.regiaoId ? { regiaoId: query.regiaoId } : {}),
  };

  const payload = await requestV4('get', '/inventory/boards', {
    operation: 'inventory.boards.read',
    params,
  });
  const boards = normalizeBoards(dataList(payload).map(boardToCanonical).filter(Boolean));
  return ensureNoProductionMock(boards, 'inventory.boards.read');
}

export async function getBoardById(id) {
  const payload = await requestV4('get', `/inventory/boards/${id}`, {
    operation: 'inventory.board.read',
  });
  return ensureNoProductionMock(normalizeBoardPayload(payload), 'inventory.board.read');
}

export async function updateBoard(id, boardData) {
  const payload = await requestV4('patch', `/inventory/boards/${id}`, {
    operation: 'inventory.board.update',
    data: boardPayloadFromUi(boardData),
  });
  return ensureNoProductionMock(normalizeBoardPayload(payload), 'inventory.board.update');
}

export async function toggleBoardAvailability(id) {
  const payload = await requestV4('patch', `/inventory/boards/${id}/availability`, {
    operation: 'inventory.board.toggle-availability',
  });
  return ensureNoProductionMock(normalizeBoardPayload(payload), 'inventory.board.toggle-availability');
}

export async function getInventorySummary() {
  const payload = await requestV4('get', '/inventory/summary', {
    operation: 'inventory.summary.read',
  });
  return ensureNoProductionMock(normalizeInventorySummary(payload), 'inventory.summary.read');
}

export async function getInventoryRegions() {
  const payload = await requestV4('get', '/inventory/regions', {
    operation: 'inventory.regions.read',
  });
  return ensureNoProductionMock(normalizeRegionPayload(payload), 'inventory.regions.read');
}

export async function createBoard(boardData = {}) {
  const data = {};
  if (typeof boardData.codigo === 'string' && boardData.codigo.trim()) {
    data.numero_placa = boardData.codigo.trim();
  }
  // Endereço canônico
  if (typeof boardData.endereco === 'string' && boardData.endereco) data.endereco = boardData.endereco;
  if (typeof boardData.localizacao === 'string') data.nomeDaRua = boardData.localizacao;
  // Coordenadas
  const coords = normalizeBoardCoordinates(boardData);
  if (coords.hasCoordinates) {
    data.latitude = coords.latitude;
    data.longitude = coords.longitude;
    data.coordinates = { latitude: coords.latitude, longitude: coords.longitude };
    data.coordenadas = `${coords.latitude},${coords.longitude}`;
  }
  // Região
  if (typeof boardData.regiaoId === 'string' && boardData.regiaoId) data.regiaoId = boardData.regiaoId;
  if (typeof boardData.regionalLot === 'string' && boardData.regionalLot) data.regionalLot = boardData.regionalLot;
  // Status canônicos
  if (typeof boardData.statusOperacional === 'string') data.statusOperacional = boardData.statusOperacional;
  // Dimensões / receita
  if (typeof boardData.tamanho === 'string') data.tamanho = boardData.tamanho;
  // Observações
  if (typeof boardData.notes === 'string') data.notes = boardData.notes;
  // Imagem
  if (typeof boardData.imageUrl === 'string' && !boardData.imageUrl.startsWith('blob:')) {
    data.imagem = boardData.imageUrl;
  }

  const payload = await requestV4('post', '/inventory/boards', {
    operation: 'inventory.board.create',
    data,
  });
  return ensureNoProductionMock(normalizeBoardPayload(payload), 'inventory.board.create');
}

function assertImageFile(file) {
  if (!(file instanceof File)) throw new Error('Selecione um arquivo de imagem valido.');
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.');
}

export async function uploadBoardImage(boardId, file, options = {}) {
  if (!boardId) throw new Error('Salve a placa para enviar imagens.');
  assertImageFile(file);
  const formData = new FormData();
  formData.append('imagem', file);
  formData.append('source', 'UPLOAD');
  if (options.category) formData.append('category', options.category);
  if (options.setAsMain != null) formData.append('setAsMain', String(options.setAsMain));
  if (options.templateId) formData.append('templateId', options.templateId);
  if (options.generationSource) formData.append('generationSource', options.generationSource);
  if (options.generatedBy) formData.append('generatedBy', options.generatedBy);
  if (options.version) formData.append('version', String(options.version));

  const payload = await requestFirstAvailable('post', [v1Base(`/placas/${encodeURIComponent(boardId)}/images`)], {
    operation: 'inventory.board.image.upload',
    data: formData,
  });
  return ensureNoProductionMock(normalizeBoardPayload(payload), 'inventory.board.image.upload');
}

export async function setBoardMainImage(boardId, imageId) {
  const payload = await requestFirstAvailable('patch', [v1Base(`/placas/${encodeURIComponent(boardId)}/images/${encodeURIComponent(imageId)}/main`)], {
    operation: 'inventory.board.image.set-main',
  });
  return ensureNoProductionMock(normalizeBoardPayload(payload), 'inventory.board.image.set-main');
}

export async function removeBoardImage(boardId, imageId) {
  const payload = await requestFirstAvailable('delete', [v1Base(`/placas/${encodeURIComponent(boardId)}/images/${encodeURIComponent(imageId)}`)], {
    operation: 'inventory.board.image.remove',
  });
  return ensureNoProductionMock(normalizeBoardPayload(payload), 'inventory.board.image.remove');
}

export async function getBoardImages(boardId) {
  const board = await getBoardById(boardId);
  return board.imagens ?? [];
}

export async function deleteBoard(id) {
  const payload = await requestV4('delete', `/inventory/boards/${encodeURIComponent(id)}`, {
    operation: 'inventory.board.delete',
  });
  return ensureNoProductionMock(payload?.data ?? payload ?? { id }, 'inventory.board.delete');
}
