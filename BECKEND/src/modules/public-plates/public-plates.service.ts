import { Types } from 'mongoose';
import Placa from '@modules/placas/Placa';
import Regiao from '@modules/regioes/Regiao';
import { commercialAvailabilityProjection, type CommercialAvailabilityResult } from '@modules/commercial-availability';
import { recordProjectionMetric } from '@shared/infra/monitoring/projection-metrics';
import { projectionCacheService, makeCacheKey, timeBucket, CACHE_TTL_MS } from '@shared/infra/cache';
import { batchIsImageNotFound, isImageCacheAvailable } from './image-cache.service';
import { plateMediaService } from '@modules/media/plate-media.service';
import {
  toPublicPlaca,
  toPublicRegiao,
  toSlug,
  type PlateMediaResolved,
  type PublicDisponibilidadePayload,
  type PublicPlacaPayload,
  type PublicRegiaoPayload,
} from './public-plates.presenter';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 24;
const AVAILABILITY_FILTER_CANDIDATE_LIMIT = 500;
const EXPORT_DEFAULT_MAX = 1000;

// Seleciona apenas campos de identidade, localização e status — sem campos de imagem
// legados, pois a resolução de imagem agora é feita exclusivamente via PlateMedia.
const PLACA_PUBLIC_SELECT =
  '_id empresaId numero_placa endereco nomeDaRua localizacao tipo tamanho statusComercial statusOperacional regiaoId latitude longitude updatedAt';

const REGIAO_POPULATE = {
  path: 'regiaoId',
  select: 'nome name city state code codigo',
};

export interface PlacasFilter {
  cidade?: string;
  regiao?: string;
  regiaoId?: string;
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

export interface PlacasExportResult {
  data: PublicPlacaPayload[];
  meta: { total: number; cacheHit: boolean; source: string; exportedAt: string };
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveRegiaoIds(
  empresaId: string,
  regiaoNome?: string,
  cidade?: string,
  regiaoId?: string,
): Promise<string[] | null> {
  if (regiaoId) {
    if (!Types.ObjectId.isValid(regiaoId)) return [];
    return [regiaoId];
  }

  if (!regiaoNome && !cidade) return null;

  const regiaoFilter: Record<string, unknown> = { empresaId };
  if (regiaoNome) {
    const escaped = escapeRegex(regiaoNome);
    regiaoFilter.$or = [
      { nome: { $regex: new RegExp(escaped, 'i') } },
      { name: { $regex: new RegExp(escaped, 'i') } },
    ];
  }
  if (cidade) {
    regiaoFilter.city = { $regex: new RegExp(escapeRegex(cidade), 'i') };
  }

  const regioes = await Regiao.find(regiaoFilter).select('_id').lean();
  return regioes.map((r: any) => r._id.toString());
}

/** Constrói um PlateMediaResolved a partir de um documento IPlateMedia (ou null). */
function toPlateMediaResolved(pm: { activeKey?: string | null; version?: string } | null | undefined): PlateMediaResolved | null {
  if (!pm || !pm.activeKey) return null;
  return { activeKey: pm.activeKey, version: pm.version ?? '' };
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

  const regiaoIds = await resolveRegiaoIds(empresaId, filters.regiao, filters.cidade, filters.regiaoId);
  if (regiaoIds !== null) {
    if (regiaoIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
    query.regiaoId = { $in: regiaoIds };
  }

  if (filters.categoria) {
    query.tipo = { $regex: new RegExp(escapeRegex(filters.categoria), 'i') };
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

  const plateIds = docsToProject.map((doc: any) => String(doc._id));

  // Resolve commercial statuses e PlateMedia em paralelo para minimizar latência.
  const [commercialStatuses, plateMediaMap] = await Promise.all([
    commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
      empresaId,
      placaIds: plateIds,
    }),
    plateMediaService.batchResolvePlateMedia(plateIds, empresaId),
  ]);

  const projectedData = docsToProject
    .map((doc: any) => {
      const pm = plateMediaMap.get(String(doc._id));
      return toPublicPlaca(
        { ...doc, commercialStatus: publicCommercialStatus(commercialStatuses.get(String(doc._id))!) },
        toPlateMediaResolved(pm),
      );
    })
    .filter((placa) => {
      if (!filters.disponibilidade) return true;
      const expected = normalizeDisponibilidade(filters.disponibilidade);
      return !expected || placa.disponibilidade === expected;
    });

  const paginatedData = filters.disponibilidade
    ? projectedData.slice(skip, skip + limit)
    : projectedData;
  const total = filters.disponibilidade ? projectedData.length : sortedDocs.length;

  // Consistência listing/proxy: se o proxy registrou NoSuchKey para alguma placa,
  // limpa hasImage na listagem para evitar imagemUrl inacessível.
  let finalData = paginatedData;
  if (isImageCacheAvailable()) {
    const idsComImagem = paginatedData.filter((p) => p.hasImage && p.id).map((p) => p.id);
    if (idsComImagem.length > 0) {
      const notFoundIds = await batchIsImageNotFound(idsComImagem);
      if (notFoundIds.size > 0) {
        finalData = paginatedData.map((p) =>
          notFoundIds.has(p.id)
            ? {
                ...p,
                hasImage: false,
                imagemUrl: null,
                imagem: null,
                imagemMeta: null,
                jetImageUrl: null,
                jet_image_url: null,
                jetImage: null,
                image: null,
              }
            : p,
        );
      }
    }
  }

  return {
    data: finalData,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    meta: { cacheHit: false, source: 'projection' },
  };
}

/**
 * Retorna todas as placas públicas sem paginação, para consumo bulk (WordPress/JetEngine).
 */
export async function listAllPlacas(
  empresaId: string,
  filters: PlacasFilter,
): Promise<PlacasExportResult> {
  const maxItems = (() => {
    const env = parseInt(process.env.PUBLIC_EXPORT_MAX_ITEMS ?? '', 10);
    return Number.isFinite(env) && env > 0 ? env : EXPORT_DEFAULT_MAX;
  })();

  const query: Record<string, unknown> = {
    empresaId,
    statusOperacional: { $ne: 'ARCHIVED' },
  };

  const regiaoIds = await resolveRegiaoIds(empresaId, filters.regiao, filters.cidade, filters.regiaoId);
  if (regiaoIds !== null) {
    if (regiaoIds.length === 0) {
      return { data: [], meta: { total: 0, cacheHit: false, source: 'projection', exportedAt: new Date().toISOString() } };
    }
    query.regiaoId = { $in: regiaoIds };
  }

  if (filters.categoria) {
    query.tipo = { $regex: new RegExp(escapeRegex(filters.categoria), 'i') };
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

  const cappedDocs = sortedDocs.slice(0, maxItems);
  const plateIds = cappedDocs.map((doc: any) => String(doc._id));

  const [commercialStatuses, plateMediaMap] = await Promise.all([
    commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
      empresaId,
      placaIds: plateIds,
    }),
    plateMediaService.batchResolvePlateMedia(plateIds, empresaId),
  ]);

  let projected = cappedDocs
    .map((doc: any) => {
      const pm = plateMediaMap.get(String(doc._id));
      return toPublicPlaca(
        { ...doc, commercialStatus: publicCommercialStatus(commercialStatuses.get(String(doc._id))!) },
        toPlateMediaResolved(pm),
      );
    })
    .filter((placa) => {
      if (!filters.disponibilidade) return true;
      const expected = normalizeDisponibilidade(filters.disponibilidade);
      return !expected || placa.disponibilidade === expected;
    });

  // Consistência listing/proxy: limpa hasImage quando proxy registrou NoSuchKey.
  if (isImageCacheAvailable()) {
    const idsComImagem = projected.filter((p) => p.hasImage && p.id).map((p) => p.id);
    if (idsComImagem.length > 0) {
      const notFoundIds = await batchIsImageNotFound(idsComImagem);
      if (notFoundIds.size > 0) {
        projected = projected.map((p) =>
          notFoundIds.has(p.id)
            ? { ...p, hasImage: false, imagemUrl: null, imagem: null, imagemMeta: null, jetImageUrl: null, jet_image_url: null, jetImage: null, image: null }
            : p,
        );
      }
    }
  }

  return {
    data: projected,
    meta: { total: projected.length, cacheHit: false, source: 'projection', exportedAt: new Date().toISOString() },
  };
}

export async function getPlacaBySlug(
  empresaId: string,
  slug: string,
): Promise<PublicPlacaPayload | null> {
  const upper = slug.toUpperCase();
  let doc = await Placa.findOne({ empresaId, numero_placa: upper })
    .select(PLACA_PUBLIC_SELECT)
    .populate(REGIAO_POPULATE)
    .lean();

  if (!doc) {
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

  const id = String((doc as any)._id);
  const [commercialStatus, plateMedia] = await Promise.all([
    commercialAvailabilityProjection.resolvePlateCommercialStatus({ empresaId, placaId: id }),
    plateMediaService.resolvePlateMainImage(id, empresaId),
  ]);

  return toPublicPlaca(
    { ...doc, commercialStatus: publicCommercialStatus(commercialStatus) },
    plateMedia.hasImage ? { activeKey: plateMedia.activeKey, version: plateMedia.version } : null,
  );
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
      const id = String((doc as any)._id);
      const [commercialStatus, plateMedia] = await Promise.all([
        commercialAvailabilityProjection.resolvePlateCommercialStatus({ empresaId, placaId: id }),
        plateMediaService.resolvePlateMainImage(id, empresaId),
      ]);
      return toPublicPlaca(
        { ...doc, commercialStatus: publicCommercialStatus(commercialStatus) },
        plateMedia.hasImage ? { activeKey: plateMedia.activeKey, version: plateMedia.version } : null,
      );
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

export async function getDisponibilidade(empresaId: string): Promise<PublicDisponibilidadePayload & { cacheHit?: boolean }> {
  const startedAt = Date.now();

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

  const counts = { disponivel: 0, reservado: 0, ocupado: 0, indisponivel: 0 };

  commercialStatuses.forEach((status) => {
    // Resolve status sem imagem (plateMedia=null) — apenas o campo disponibilidade importa aqui.
    const publicStatus = toPublicPlaca({
      _id: 'status-only',
      numero_placa: 'status-only',
      commercialStatus: publicCommercialStatus(status),
    }, null).disponibilidade;
    if (publicStatus === 'desconhecido') return;
    counts[publicStatus] += 1;
  });

  const result: PublicDisponibilidadePayload = { total: docs.length, ...counts };

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
