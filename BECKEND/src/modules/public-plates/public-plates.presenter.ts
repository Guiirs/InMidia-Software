/**
 * Mapeia um documento de Placa (com regiaoId populado) para o payload público seguro.
 *
 * imagemUrl e imagem apontam para o proxy seguro interno (/api/v1/public/placas/:id/imagem),
 * nunca para URLs diretas do R2 ou do bucket privado.
 */
import logger from '@shared/container/logger';

/** Metadata rica de imagem — novo campo adicionado na v2 do payload. */
export interface PublicImageMeta {
  url: string;
  /** MIME type derivado da extensão do arquivo. Null se não for possível inferir. */
  mimeType: string | null;
  /** Indica que a imagem é servida via proxy com Cache-Control CDN-ready. */
  cacheable: boolean;
  updatedAt: string | null;
}

export interface PublicJetImagePayload {
  id: 0;
  url: string;
  alt: string;
  title: string;
}

export interface PublicImagePayload {
  url: string;
  alt: string;
  title: string;
}

export interface PublicPlacaPayload {
  id: string;
  slug: string;
  codigo: string;
  nome: string;
  localizacao: string | null;
  status: 'disponivel' | 'reservado' | 'ocupado' | 'indisponivel' | 'desconhecido';
  /** URL do proxy de imagem. Mantido para compatibilidade. @see imagemMeta */
  imagemUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
  regiao: string | null;
  cidade: string | null;
  categoria: string | null;
  medidas: string | null;
  /** Alias de imagemUrl. Mantido para compatibilidade com consumidores legados. */
  imagem: string | null;
  /** Metadata rica de imagem (novo campo v2). Null se placa não tiver imagem. */
  imagemMeta: PublicImageMeta | null;
  jetImageUrl: string | null;
  jet_image_url: string | null;
  jetImage: PublicJetImagePayload | null;
  image: PublicImagePayload | null;
  disponibilidade: 'disponivel' | 'reservado' | 'ocupado' | 'indisponivel' | 'desconhecido';
  updatedAt: string | null;
}

export interface PublicRegiaoPayload {
  slug: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
}

export interface PublicDisponibilidadePayload {
  total: number;
  disponivel: number;
  reservado: number;
  ocupado: number;
  indisponivel: number;
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

/**
 * Deriva MIME type da extensão do path/URL armazenado no banco.
 * Nunca faz chamada ao R2 — resultado é best-effort a partir da extensão.
 */
export function mimeTypeFromStoredPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.includes('?') ? value.slice(0, value.indexOf('?')) : value;
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx === -1) return null;
  return MIME_BY_EXT[path.slice(dotIdx).toLowerCase()] ?? null;
}

const statusComercialMap: Record<string, PublicPlacaPayload['disponibilidade']> = {
  AVAILABLE: 'disponivel',
  RESERVED: 'reservado',
  OCCUPIED: 'ocupado',
  UNAVAILABLE: 'indisponivel',
};

let warnedMissingPublicApiBaseUrl = false;
let warnedInvalidPublicApiBaseUrl = false;

function warnMissingPublicApiBaseUrl(): void {
  if (warnedMissingPublicApiBaseUrl) return;
  warnedMissingPublicApiBaseUrl = true;
  logger.warn('[PUBLIC_API] PUBLIC_API_BASE_URL ausente. Usando fallback relativo. Integrações externas podem falhar.');
}

function warnInvalidPublicApiBaseUrl(value: string, reason: string): void {
  if (warnedInvalidPublicApiBaseUrl) return;
  warnedInvalidPublicApiBaseUrl = true;
  logger.warn(`[PUBLIC_API] PUBLIC_API_BASE_URL invalida reason=${reason} value=${value}. Usando fallback relativo. Integrações externas podem falhar.`);
}

function isProductionUnsafeHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '0.0.0.0' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  );
}

export function getPublicApiBaseUrl(): string {
  const configured = process.env.PUBLIC_API_BASE_URL?.trim();
  if (!configured) {
    warnMissingPublicApiBaseUrl();
    return '';
  }

  const normalized = configured.replace(/\/+$/, '');

  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) {
      warnInvalidPublicApiBaseUrl(configured, 'invalid_protocol');
      return '';
    }
    if (process.env.NODE_ENV === 'production' && isProductionUnsafeHost(url.hostname)) {
      warnInvalidPublicApiBaseUrl(configured, 'unsafe_production_host');
      return '';
    }
    return normalized;
  } catch {
    warnInvalidPublicApiBaseUrl(configured, 'invalid_url');
    return '';
  }
}

export function validatePublicApiBaseUrlAtStartup(): void {
  void getPublicApiBaseUrl();
}

/**
 * Constrói a URL do proxy seguro de imagem para a placa com o id informado.
 * Nunca expõe a URL real do R2 ou do bucket.
 */
export function buildProxyImageUrl(placaId: string): string {
  const base = getPublicApiBaseUrl();
  return `${base}/api/v1/public/placas/${placaId}/imagem`;
}

/** @internal Mantido apenas para uso em testes legados. Não usar em produção. */
export function normalizePublicImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const baseUrl = (process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || '').replace(/\/+$/, '');
  const folderName = (process.env.R2_FOLDER_NAME || 'inmidia-uploads-sistema').replace(/^\/+|\/+$/g, '');
  const key = raw.replace(/^\/+/, '');
  const storageKey = key.includes('/') ? key : `${folderName}/${key}`;
  return baseUrl ? `${baseUrl}/${storageKey}` : storageKey;
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildImageAltTitle(placa: { nome?: unknown; codigo?: unknown; numero_placa?: unknown }): string {
  const nome = typeof placa.nome === 'string' ? placa.nome.trim() : '';
  if (nome) return nome;

  const codigo =
    typeof placa.codigo === 'string'
      ? placa.codigo.trim()
      : typeof placa.numero_placa === 'string'
        ? placa.numero_placa.trim()
        : '';
  if (codigo) return codigo;

  return 'Placa';
}

export function toPublicPlaca(raw: any): PublicPlacaPayload {
  const regiaoDoc = typeof raw.regiaoId === 'object' && raw.regiaoId !== null
    ? raw.regiaoId
    : null;

  const endereco = raw.endereco || raw.nomeDaRua || raw.localizacao || null;
  const statusComercial: string = raw.statusComercial ?? 'AVAILABLE';
  const disponibilidade = statusComercialMap[statusComercial] ?? 'desconhecido';
  const id = raw._id?.toString?.() ?? String(raw._id ?? '');
  const codigo = raw.numero_placa ?? '';
  const imageLabel = buildImageAltTitle({ nome: raw.nome, codigo, numero_placa: raw.numero_placa });

  // Determina se a placa tem imagem cadastrada (sem expor a URL real do storage)
  const storedPath: string | null =
    raw.imagemPrincipal ||
    raw.imagem ||
    (Array.isArray(raw.imagens) && raw.imagens.length > 0
      ? (raw.imagens.find((i: any) => i.isMain)?.key ?? raw.imagens[0]?.key ?? null)
      : null);

  const hasImage = !!storedPath;
  const proxyUrl = hasImage && id ? buildProxyImageUrl(id) : null;
  const resolvedUpdatedAt = raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null;

  const imagemMeta: PublicImageMeta | null = proxyUrl
    ? {
        url: proxyUrl,
        mimeType: mimeTypeFromStoredPath(storedPath),
        cacheable: true,
        updatedAt: resolvedUpdatedAt,
      }
    : null;
  const jetImage: PublicJetImagePayload | null = proxyUrl
    ? {
        id: 0,
        url: proxyUrl,
        alt: imageLabel,
        title: imageLabel,
      }
    : null;
  const image: PublicImagePayload | null = proxyUrl
    ? {
        url: proxyUrl,
        alt: imageLabel,
        title: imageLabel,
      }
    : null;

  return {
    id,
    slug: toSlug(codigo),
    codigo,
    nome: codigo,
    localizacao: endereco,
    status: disponibilidade,
    imagemUrl: proxyUrl,
    latitude: typeof raw.latitude === 'number' ? raw.latitude : null,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : null,
    endereco,
    regiao: regiaoDoc?.nome ?? raw.regiaoNome ?? null,
    cidade: regiaoDoc?.city ?? null,
    categoria: raw.tipo ?? null,
    medidas: raw.tamanho ?? null,
    imagem: proxyUrl,
    imagemMeta,
    jetImageUrl: proxyUrl,
    jet_image_url: proxyUrl,
    jetImage,
    image,
    disponibilidade,
    updatedAt: resolvedUpdatedAt,
  };
}

export function toPublicRegiao(raw: any): PublicRegiaoPayload {
  const nome: string = raw.nome || raw.name || '';
  return {
    slug: toSlug(raw.code || raw.codigo || nome),
    nome,
    cidade: raw.city ?? null,
    estado: raw.state ?? null,
  };
}
