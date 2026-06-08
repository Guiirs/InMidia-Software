/**
 * Mapeia um documento de Placa (com regiaoId populado) para o payload público seguro.
 *
 * imagemUrl aponta para o proxy seguro canônico (/api/v1/public/media/plates/:id/main).
 * A versão (?v=) é derivada de PlateMedia.version para garantir cache-busting automático
 * quando a imagem principal for trocada.
 *
 * FONTE ÚNICA DE VERDADE: PlateMedia.activeKey
 * Nenhum campo legado (imagemPrincipal, imagem, imagens[]) é consultado.
 *
 * Campos legados (imagem, jetImageUrl, etc.) são mantidos como aliases para
 * retrocompatibilidade com integrações WordPress/JetEngine.
 * Nunca expõe URLs diretas do R2 ou credenciais do bucket.
 */
import logger from '@shared/container/logger';

export interface PlateMediaResolved {
  activeKey: string | null;
  version: string;
}

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
  /** URL canônica do proxy de imagem (inclui ?v= para cache-busting). */
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
 * Inclui ?v={version} para cache-busting automático no browser quando a imagem trocar.
 * Nunca expõe a URL real do R2 ou do bucket.
 */
export function buildProxyImageUrl(placaId: string, version?: string | null): string {
  const base = getPublicApiBaseUrl();
  const path = `${base}/api/v1/public/media/plates/${placaId}/main`;
  if (version && version.trim()) {
    return `${path}?v=${encodeURIComponent(version.trim())}`;
  }
  return path;
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

/**
 * Converte um documento de Placa para o payload público.
 *
 * @param raw        Documento Placa (lean) com regiaoId populado.
 * @param plateMedia Dados resolvidos de PlateMedia para esta placa.
 *                   Se null, a placa não tem imagem cadastrada no sistema canônico.
 */
export function toPublicPlaca(raw: any, plateMedia?: PlateMediaResolved | null): PublicPlacaPayload {
  const regiaoDoc = typeof raw.regiaoId === 'object' && raw.regiaoId !== null
    ? raw.regiaoId
    : null;

  const endereco = raw.endereco || raw.nomeDaRua || raw.localizacao || null;
  const statusComercial: string = raw.commercialStatus ?? raw.statusComercial ?? 'AVAILABLE';
  const disponibilidade = statusComercialMap[statusComercial] ?? 'desconhecido';
  const id = raw._id?.toString?.() ?? String(raw._id ?? '');
  const codigo = raw.numero_placa ?? '';
  const imageLabel = buildImageAltTitle({ nome: raw.nome, codigo, numero_placa: raw.numero_placa });

  // ── Imagem — fonte única: PlateMedia.activeKey ────────────────────────────────
  const hasImage = !!(plateMedia?.activeKey);
  const proxyUrl = hasImage && id ? buildProxyImageUrl(id, plateMedia?.version) : null;
  const resolvedUpdatedAt = raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null;

  // Campos deprecated — mantidos para retrocompatibilidade com WordPress/JetEngine/Elementor.
  const imagemMeta: PublicImageMeta | null = proxyUrl
    ? { url: proxyUrl, mimeType: null, cacheable: true, updatedAt: resolvedUpdatedAt }
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
