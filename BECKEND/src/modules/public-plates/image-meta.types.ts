/**
 * Tipos de metadata de imagem usados pelo proxy público e pelo Redis cache.
 * Isolados aqui para evitar acoplamento entre controller, cache service e presenter.
 */

/** Entrada de metadata armazenada no Redis para um ObjectId de placa. */
export interface ImageMetaCache {
  placaId: string;
  r2Key: string;
  /** ETag no formato S3 com aspas: '"abc123"'. */
  etag: string;
  /** Data RFC 7231: "Thu, 01 Jan 2026 00:00:00 GMT". */
  lastModified: string;
  contentType: string;
  contentLength?: number;
  /** updatedAt da placa no banco (ISO string). */
  updatedAt: string;
}

/** Resultado do pipeline de resolução de metadata de imagem. */
export interface ImageMetaResult {
  meta: ImageMetaCache;
  /** Origem: cache Redis, HeadObject R2 ou GetObject R2. */
  source: 'redis' | 'head' | 'get';
}

/** Objeto de observabilidade gerado ao final de cada request de imagem. */
export interface ImageProxyMetrics {
  placaId: string;
  cacheStatus: 'hit' | 'miss' | 'redis_unavailable';
  outcome: 200 | 304 | 400 | 404 | 500 | 503;
  conditional: boolean;
  r2LatencyMs: number | null;
  contentType: string | null;
  bytesSent: number | null;
}
