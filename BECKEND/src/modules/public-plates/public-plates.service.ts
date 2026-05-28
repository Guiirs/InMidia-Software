import { Types } from 'mongoose';
import Placa from '@modules/placas/Placa';
import Regiao from '@modules/regioes/Regiao';
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
}

type NaturalSortablePlaca = Pick<PublicPlacaPayload, 'codigo' | 'slug'> & {
  nome?: string | null;
};

/** Maps URL disponibilidade param to statusComercial value. */
function mapDisponibilidade(value: string): string | null {
  const map: Record<string, string> = {
    disponivel: 'AVAILABLE',
    reservado: 'RESERVED',
    ocupado: 'OCCUPIED',
    indisponivel: 'UNAVAILABLE',
  };
  return map[value.toLowerCase()] ?? null;
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

  if (filters.disponibilidade) {
    const sc = mapDisponibilidade(filters.disponibilidade);
    if (sc) query.statusComercial = sc;
  }

  const [total, docs] = await Promise.all([
    Placa.countDocuments(query),
    Placa.find(query)
      .select(PLACA_PUBLIC_SELECT)
      .populate(REGIAO_POPULATE)
      .lean(),
  ]);

  const sortedData = docs
    .map(toPublicPlaca)
    .sort((left, right) =>
      comparePublicPlacasNaturally(
        { codigo: left.codigo, slug: left.slug, nome: left.codigo },
        { codigo: right.codigo, slug: right.slug, nome: right.codigo },
      ),
    );

  const skip = (page - 1) * limit;
  const paginatedData = sortedData.slice(skip, skip + limit);

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
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
      doc = await Placa.findById((match as any)._id)
        .select(PLACA_PUBLIC_SELECT)
        .populate(REGIAO_POPULATE)
        .lean();
    }
  }

  return doc ? toPublicPlaca(doc) : null;
}

export async function getPlacaByIdOrSlug(
  empresaId: string,
  idOrSlug: string,
): Promise<PublicPlacaPayload | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  if (Types.ObjectId.isValid(trimmed)) {
    const doc = await Placa.findById(trimmed)
      .select(PLACA_PUBLIC_SELECT)
      .populate(REGIAO_POPULATE)
      .lean();

    if (
      doc &&
      String(doc.empresaId ?? '') === String(empresaId) &&
      doc.statusOperacional !== 'ARCHIVED'
    ) {
      return toPublicPlaca(doc);
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

export async function getDisponibilidade(empresaId: string): Promise<PublicDisponibilidadePayload> {
  const pipeline = [
    { $match: { empresaId, statusOperacional: { $ne: 'ARCHIVED' } } },
    { $group: { _id: '$statusComercial', count: { $sum: 1 } } },
  ];

  const results: Array<{ _id: string; count: number }> = await (Placa as any).aggregate(pipeline);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of results) {
    counts[r._id] = r.count;
    total += r.count;
  }

  return {
    total,
    disponivel: counts['AVAILABLE'] ?? 0,
    reservado: counts['RESERVED'] ?? 0,
    ocupado: counts['OCCUPIED'] ?? 0,
    indisponivel: counts['UNAVAILABLE'] ?? 0,
  };
}
