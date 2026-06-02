/**
 * Mapeia um documento de Placa (com regiaoId populado) para o payload público seguro.
 *
 * imagemUrl aponta para o proxy seguro canônico (/api/v1/public/media/plates/:id/main).
 * Campos legados (imagem, jetImageUrl, etc.) são mantidos como aliases para
 * retrocompatibilidade com integrações WordPress/JetEngine.
 * Nunca expõe URLs diretas do R2 ou credenciais do bucket.
 */
import logger from '@shared/container/logger';
import { contentTypeFromStorageKey, resolvePlacaImageReference } from '@modules/media/placa-image-reference.resolver';

export interface PublicImageMeta {
  url: string;
  mimeType: string | null;
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
  /** URL canônica do proxy de imagem. */
  imagemUrl: string | null;
  hasImage: boolean;
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
  regiao: string | null;
  cidade: string | null;
  categoria: string | null;
  medidas: string | null;
  /** @deprecated Alias de imagemUrl — mantido para retrocompatibilidade. */
  imagem: string | null;
  /** @deprecated Alias de imagemUrl — mantido para retrocompatibilidade. */
  imagemMeta: PublicImageMeta | null;
  /** @deprecated Alias de imagemUrl — mantido para retrocompatibilidade com JetEngine. */
  jetImageUrl: string | null;
  /** @deprecated Alias de imagemUrl — mantido para retrocompatibilidade com JetEngine. */
  jet_image_url: string | null;
  /** @deprecated Alias de imagemUrl — mantido para retrocompatibilidade com JetEngine. */
  jetImage: PublicJetImagePayload | null;
  /** @deprecated Alias de imagemUrl — mantido para retrocompatibilidade com Elementor. */
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

/**
 * Deriva MIME type da extensão do path/URL armazenado no banco.
 * Nunca faz chamada ao R2 — resultado é best-effort a partir da extensão.
 */
export function mimeTypeFromStoredPath(value: string | null | undefined): string | null {
  return contentTypeFromStorageKey(value);
}

const statusComercialMap: Record<string, PublicPlacaPayload['disponibilidade']> = {
  AVAILABLE: 'disponivel',
  RESERVED: 'reservado',
  FUTURE_RESERVED: 'reservado',
  OCCUPIED: 'ocupado',
  CONTRACTED_ACTIVE: 'ocupado',
  UNAVAILABLE: 'indisponivel',
  MAINTENANCE: 'indisponivel',
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
 * Constrói a URL canônica do proxy seguro de imagem para a placa com o id informado.
 * Nunca expõe a URL real do R2 ou do bucket.
 */
export function buildProxyImageUrl(placaId: string): string {
  const base = getPublicApiBaseUrl();
  return `${base}/api/v1/public/media/plates/${placaId}/main`;
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
  const statusComercial: string = raw.commercialStatus ?? raw.statusComercial ?? 'AVAILABLE';
  const disponibilidade = statusComercialMap[statusComercial] ?? 'desconhecido';
  const id = raw._id?.toString?.() ?? String(raw._id ?? '');
  const codigo = raw.numero_placa ?? '';
  const imageLabel = buildImageAltTitle({ nome: raw.nome, codigo, numero_placa: raw.numero_placa });

  const resolvedImage = resolvePlacaImageReference(raw);
  const storedPath = resolvedImage.storageKey;
  const hasImage = resolvedImage.hasImage;
  const proxyUrl = hasImage && id ? buildProxyImageUrl(id) : null;
  const resolvedUpdatedAt = raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null;

  // Deprecated alias fields — mantidos para retrocompatibilidade com WordPress/JetEngine/Elementor.
  const imagemMeta: PublicImageMeta | null = proxyUrl
    ? {
        url: proxyUrl,
        mimeType: resolvedImage.contentType ?? mimeTypeFromStoredPath(storedPath),
        cacheable: true,
        updatedAt: resolvedUpdatedAt,
      }
    : null;
  const jetImage: PublicJetImagePayload | null = proxyUrl
    ? { id: 0, url: proxyUrl, alt: imageLabel, title: imageLabel }
    : null;
  const image: PublicImagePayload | null = proxyUrl
    ? { url: proxyUrl, alt: imageLabel, title: imageLabel }
    : null;

  return {
    id,
    slug: toSlug(codigo),
    codigo,
    nome: codigo,
    localizacao: endereco,
    status: disponibilidade,
    imagemUrl: proxyUrl,
    hasImage,
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
