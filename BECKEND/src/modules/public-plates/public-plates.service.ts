import { Types } from 'mongoose';
import Placa from '@modules/placas/Placa';
import Regiao from '@modules/regioes/Regiao';
import { commercialAvailabilityProjection, type CommercialAvailabilityResult } from '@modules/commercial-availability';
import { recordProjectionMetric } from '@shared/infra/monitoring/projection-metrics';
import { projectionCacheService, makeCacheKey, timeBucket, CACHE_TTL_MS } from '@shared/infra/cache';
import {
  toPublicPlaca,
  toPublicRegiao,
  toSlug,
  type PublicDisponibilidadePayload,
  type PublicPlacaPayload,
  type PublicRegiaoPayload,
} from './public-plates.presenter';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 24;
const AVAILABILITY_FILTER_CANDIDATE_LIMIT = 500;

const PLACA_PUBLIC_SELECT =
  '_id empresaId numero_placa endereco nomeDaRua localizacao imagemPrincipal imagem imagens tipo tamanho statusComercial statusOperacional regiaoId latitude longitude updatedAt';

const PLACA_IMAGE_SELECT =
  '_id empresaId statusOperacional imagemPrincipal imagem imagens updatedAt';

const REGIAO_POPULATE = {
  path: 'regiaoId',
  select: 'nome name city state code codigo',
};

export interface PlacasFilter {
  cidade?: string;
  regiao?: string;
  categoria?: string;
  disponibilidade?: string;
}

export interface PlacasPagination {
  page?: number;
  limit?: number;
}

export interface PlacasListResult {
  data: PublicPlacaPayload[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  meta?: { cacheHit: boolean; source: string };
}

type NaturalSortablePlaca = Pick<PublicPlacaPayload, 'codigo' | 'slug'> & {
  nome?: string | null;
};

function normalizeDisponibilidade(value: string): PublicPlacaPayload['disponibilidade'] | null {
  const map: Record<string, PublicPlacaPayload['disponibilidade']> = {
    disponivel: 'disponivel',
    reservado: 'reservado',
    ocupada: 'ocupado',
    ocupado: 'ocupado',
    indisponivel: 'indisponivel',
  };
  return map[value.toLowerCase()] ?? null;
}

function publicCommercialStatus(status: CommercialAvailabilityResult): string {
  if (status.status === 'CONTRACTED_ACTIVE') return 'CONTRACTED_ACTIVE';
  if (status.status === 'RESERVED' || status.status === 'FUTURE_RESERVED') return status.status;
  if (status.status === 'MAINTENANCE') return 'MAINTENANCE';
  if (status.isCommerciallyAvailable) return 'AVAILABLE';
  return 'UNAVAILABLE';
}

function naturalCompare(left: string | null | undefined, right: string | null | undefined): number {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function comparePublicPlacasNaturally(
  left: NaturalSortablePlaca,
  right: NaturalSortablePlaca,
): number {
  const byCodigo = naturalCompare(left.codigo, right.codigo);
  if (byCodigo !== 0) return byCodigo;

  const bySlug = naturalCompare(left.slug, right.slug);
  if (bySlug !== 0) return bySlug;

  return naturalCompare(left.nome, right.nome);
}

async function resolveRegiaoIds(empresaId: string, regiaoNome?: string, cidade?: string): Promise<string[] | null> {
  if (!regiaoNome && !cidade) return null;

  const regiaoFilter: Record<string, unknown> = { empresaId };
  if (regiaoNome) {
    regiaoFilter.$or = [
      { nome: { $regex: new RegExp(regiaoNome, 'i') } },
      { name: { $regex: new RegExp(regiaoNome, 'i') } },
    ];
  }
  if (cidade) {
    regiaoFilter.city = { $regex: new RegExp(cidade, 'i') };
  }

  const regioes = await Regiao.find(regiaoFilter).select('_id').lean();
  return regioes.map((r: any) => r._id.toString());
}

export async function listPlacas(
  empresaId: string,
  filters: PlacasFilter,
  pagination: PlacasPagination,
): Promise<PlacasListResult> {
  const page = Math.max(1, pagination.page ?? 1);
  const limit = Math.min(Math.max(1, pagination.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  const query: Record<string, unknown> = {
    empresaId,
    statusOperacional: { $ne: 'ARCHIVED' },
  };

  const regiaoIds = await resolveRegiaoIds(empresaId, filters.regiao, filters.cidade);
  if (regiaoIds !== null) {
    if (regiaoIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
    query.regiaoId = { $in: regiaoIds };
  }

  if (filters.categoria) {
    query.tipo = { $regex: new RegExp(filters.categoria, 'i') };
  }

  const docs = await Placa.find(query)
      .select(PLACA_PUBLIC_SELECT)
      .populate(REGIAO_POPULATE)
      .lean();

  const sortedDocs = [...docs].sort((left: any, right: any) =>
    comparePublicPlacasNaturally(
      { codigo: left.numero_placa, slug: toSlug(left.numero_placa ?? ''), nome: left.numero_placa },
      { codigo: right.numero_placa, slug: toSlug(right.numero_placa ?? ''), nome: right.numero_placa },
    ),
  );

  const skip = (page - 1) * limit;
  const docsToProject = filters.disponibilidade
    ? sortedDocs.slice(0, AVAILABILITY_FILTER_CANDIDATE_LIMIT)
    : sortedDocs.slice(skip, skip + limit);

  const commercialStatuses = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
    empresaId,
    placaIds: docsToProject.map((doc: any) => String(doc._id)),
  });

  const projectedData = docsToProject
    .map((doc: any) => toPublicPlaca({
      ...doc,
      commercialStatus: publicCommercialStatus(commercialStatuses.get(String(doc._id))!),
    }))
    .filter((placa) => {
      if (!filters.disponibilidade) return true;
      const expected = normalizeDisponibilidade(filters.disponibilidade);
      return !expected || placa.disponibilidade === expected;
    });

  const paginatedData = filters.disponibilidade
    ? projectedData.slice(skip, skip + limit)
    : projectedData;
  const total = filters.disponibilidade ? projectedData.length : sortedDocs.length;

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    meta: { cacheHit: false, source: 'projection' },
  };
}

export async function getPlacaBySlug(
  empresaId: string,
  slug: string,
): Promise<PublicPlacaPayload | null> {
  // Fast path: slug is usually just numero_placa uppercased
  const upper = slug.toUpperCase();
  let doc = await Placa.findOne({ empresaId, numero_placa: upper })
    .select(PLACA_PUBLIC_SELECT)
    .populate(REGIAO_POPULATE)
    .lean();

  if (!doc) {
    // Fallback: case-insensitive search then slug-match
    const candidates = await Placa.find({ empresaId, statusOperacional: { $ne: 'ARCHIVED' } })
      .select('_id numero_placa')
      .lean();
    const match = candidates.find((c: any) => toSlug(c.numero_placa ?? '') === slug);
    if (match) {
      doc = await Placa.findOne({ _id: (match as any)._id, empresaId, statusOperacional: { $ne: 'ARCHIVED' } })
        .select(PLACA_PUBLIC_SELECT)
        .populate(REGIAO_POPULATE)
        .lean();
    }
  }

  if (!doc) return null;

  const commercialStatus = await commercialAvailabilityProjection.resolvePlateCommercialStatus({
    empresaId,
    placaId: String((doc as any)._id),
  });
  return toPublicPlaca({ ...doc, commercialStatus: publicCommercialStatus(commercialStatus) });
}

export async function getPlacaByIdOrSlug(
  empresaId: string,
  idOrSlug: string,
): Promise<PublicPlacaPayload | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  if (Types.ObjectId.isValid(trimmed)) {
    const doc = await Placa.findOne({ _id: trimmed, empresaId, statusOperacional: { $ne: 'ARCHIVED' } })
      .select(PLACA_PUBLIC_SELECT)
      .populate(REGIAO_POPULATE)
      .lean();

    if (doc) {
      const commercialStatus = await commercialAvailabilityProjection.resolvePlateCommercialStatus({
        empresaId,
        placaId: String((doc as any)._id),
      });
      return toPublicPlaca({ ...doc, commercialStatus: publicCommercialStatus(commercialStatus) });
    }
  }

  return getPlacaBySlug(empresaId, trimmed.toLowerCase());
}

export async function listRegioes(empresaId: string): Promise<PublicRegiaoPayload[]> {
  const docs = await Regiao.find({ empresaId, ativo: true })
    .select('nome name city state code codigo')
    .sort({ nome: 1 })
    .lean();
  return docs.map(toPublicRegiao);
}

export interface PlacaImageDoc {
  imagemPrincipal?: string | null;
  imagem?: string | null;
  imagens?: Array<{ key: string; isMain?: boolean }> | null;
  updatedAt?: Date | string | null;
}

/**
 * Busca campos de imagem de uma placa para o proxy público (sem API key).
 * Aceita MongoDB ObjectId ou numero_placa. Não faz full-scan (sem empresaId).
 * Valida apenas que a placa não está arquivada.
 */
export async function getPlacaDocForImagePublic(
  idOrSlug: string,
): Promise<PlacaImageDoc | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  const notArchived = { statusOperacional: { $ne: 'ARCHIVED' } };

  if (Types.ObjectId.isValid(trimmed)) {
    const doc = await Placa.findOne({ _id: trimmed, ...notArchived })
      .select(PLACA_IMAGE_SELECT)
      .lean();
    return doc ? (doc as PlacaImageDoc) : null;
  }

  // Fallback por numero_placa — campo indexado, sem full-scan
  const upper = trimmed.toUpperCase();
  const doc = await Placa.findOne({ numero_placa: upper, ...notArchived })
    .select(PLACA_IMAGE_SELECT)
    .lean();
  return doc ? (doc as PlacaImageDoc) : null;
}

/**
 * Busca campos de imagem de uma placa para o proxy autenticado (com API key / empresaId).
 * Valida tenant isolation: placa deve pertencer à empresa informada.
 */
export async function getPlacaDocForImage(
  empresaId: string,
  idOrSlug: string,
): Promise<PlacaImageDoc | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  const baseFilter = {
    empresaId,
    statusOperacional: { $ne: 'ARCHIVED' },
  };

  if (Types.ObjectId.isValid(trimmed)) {
    const doc = await Placa.findOne({ _id: trimmed, ...baseFilter })
      .select(PLACA_IMAGE_SELECT)
      .lean();
    if (doc) return doc as PlacaImageDoc;
  }

  // Slug fallback: numero_placa uppercase ou slug match
  const upper = trimmed.toUpperCase();
  let doc = await Placa.findOne({ ...baseFilter, numero_placa: upper })
    .select(PLACA_IMAGE_SELECT)
    .lean();

  if (!doc) {
    const candidates = await Placa.find({ ...baseFilter })
      .select('_id numero_placa')
      .lean();
    const match = candidates.find((c: any) => toSlug(c.numero_placa ?? '') === trimmed.toLowerCase());
    if (match) {
      doc = await Placa.findOne({ _id: (match as any)._id, ...baseFilter })
        .select(PLACA_IMAGE_SELECT)
        .lean();
    }
  }

  return doc ? (doc as PlacaImageDoc) : null;
}

export async function getDisponibilidade(empresaId: string): Promise<PublicDisponibilidadePayload & { cacheHit?: boolean }> {
  const startedAt = Date.now();

  // Check cache first (TTL: 60s)
  const cacheKey = makeCacheKey(empresaId, 'public_disponibilidade', String(timeBucket(CACHE_TTL_MS.PUBLIC_PLATES)));
  try {
    const cached = projectionCacheService.get<PublicDisponibilidadePayload & { cacheHit?: boolean }>(cacheKey);
    if (cached) {
      recordProjectionMetric({
        projection: 'public_plates',
        durationMs: Date.now() - startedAt,
        cacheHit: true,
      });
      return { ...cached, cacheHit: true };
    }
  } catch {
    // cache miss on error — continue to compute
  }

  const docs = await Placa.find({ empresaId, statusOperacional: { $ne: 'ARCHIVED' } })
    .select('_id')
    .lean();
  const commercialStatuses = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
    empresaId,
    placaIds: docs.map((doc: any) => String(doc._id)),
  });

  const counts = {
    disponivel: 0,
    reservado: 0,
    ocupado: 0,
    indisponivel: 0,
  };

  commercialStatuses.forEach((status) => {
    const publicStatus = toPublicPlaca({
      _id: 'status-only',
      numero_placa: 'status-only',
      commercialStatus: publicCommercialStatus(status),
    }).disponibilidade;
    if (publicStatus === 'desconhecido') return;
    counts[publicStatus] += 1;
  });

  const result: PublicDisponibilidadePayload = {
    total: docs.length,
    ...counts,
  };

  // Store in cache
  try {
    projectionCacheService.set(cacheKey, result, CACHE_TTL_MS.PUBLIC_PLATES);
  } catch {
    // non-fatal
  }

  recordProjectionMetric({
    projection: 'public_plates',
    durationMs: Date.now() - startedAt,
    plateCount: docs.length,
    cacheHit: false,
    rebuild: true,
  });

  return { ...result, cacheHit: false };
}
