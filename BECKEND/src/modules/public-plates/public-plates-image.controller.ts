/**
 * Proxy público de imagem de placa — enterprise-grade, CDN-ready.
 *
 * Segurança:
 *   - Sem autenticação (público para WordPress/JetEngine)
 *   - Rate limiting por IP (publicApiRateLimiter)
 *   - Hotlink middleware (pass-through; extensível)
 *   - ?path= / ?key= / ?url= / ?src= / ?file= → 400
 *   - Chave R2 extraída só do banco; traversal bloqueado por extractR2Key
 *   - Credenciais, keys internas e stack traces nunca expostos
 *
 * CDN / Conditional Cache:
 *   - ETag (R2 nativo via HeadObject; fallback SHA-256 de key+updatedAt)
 *   - Last-Modified (R2 LastModified ou updatedAt da placa)
 *   - If-None-Match → 304 sem rebuscar stream
 *   - If-Modified-Since → 304 sem rebuscar stream
 *   - Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400
 *   - Vary: Accept-Encoding (sem Vary: x-api-key — endpoint sem auth)
 *   - Surrogate-Control para CDNs enterprise
 *   - X-Public-Api-Version
 *
 * Performance:
 *   - Redis cache de metadata (TTL 120s) → zero lookups MongoDB ou R2 para 304
 *   - Com conditional headers + Redis hit: 304 sem NENHUMA chamada R2
 *   - Sem heaObject extra quando sem conditional headers (GetObject já devolve metadata)
 *   - Streaming puro sem bufferização
 *
 * Observabilidade:
 *   - Log estruturado ao final de cada request (cacheStatus, outcome, latência, bytes)
 */

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';
import { PublicErrorPresenter } from '@modules/public-api/presenters/public-error.presenter';
import { getR2Client, getR2BucketName } from '@shared/infra/storage/r2-client';
import { extractR2Key } from '@shared/infra/storage/r2-key.helper';
import { publicApiRateLimiter } from '@shared/infra/http/middlewares/rate-limit.middleware';
import logger from '@shared/container/logger';
import { getPlacaDocForImagePublic, type PlacaImageDoc } from './public-plates.service';
import {
  getImageMetaFromCache,
  setImageMetaInCache,
  isImageCacheAvailable,
} from './image-cache.service';
import type { ImageMetaCache, ImageProxyMetrics } from './image-meta.types';

export { publicApiRateLimiter as imageRateLimiter };

// ── Constantes ─────────────────────────────────────────────────────────────────

const IMAGE_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400';
const IMAGE_SURROGATE_CONTROL = 'max-age=604800';
const IMAGE_VARY = 'Accept-Encoding';
const PUBLIC_API_VERSION = 'v1';

const BLOCKED_QUERY_PARAMS = ['path', 'key', 'file', 'url', 'src'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveRequestId(req: Request): string {
  return req.header('x-request-id') ?? 'unknown';
}

function resolveImageValue(doc: PlacaImageDoc): string | null {
  return (
    doc.imagemPrincipal ||
    doc.imagem ||
    doc.imagens?.find((img) => img.isMain)?.key ||
    doc.imagens?.[0]?.key ||
    null
  );
}

/** ETag fallback: SHA-256(r2Key + updatedAt), estável e barato. */
function computeFallbackETag(r2Key: string, updatedAt: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(r2Key)
    .update(updatedAt)
    .digest('hex')
    .slice(0, 32);
  return `"${hash}"`;
}

/** Normaliza ETag para o formato S3 com aspas: '"abc"'. */
function normalizeETag(etag: string | undefined): string {
  if (!etag) return `"unknown"`;
  return etag.startsWith('"') ? etag : `"${etag}"`;
}

/** Verifica se a request tem headers de cache condicional. */
function hasConditionalHeaders(req: Request): boolean {
  return !!(req.header('if-none-match') || req.header('if-modified-since'));
}

/**
 * Verifica se o cache condicional resulta em 304.
 * Implementa RFC 7232 (precedência: ETag > Last-Modified).
 */
function isNotModified(req: Request, meta: Pick<ImageMetaCache, 'etag' | 'lastModified'>): boolean {
  const ifNoneMatch = req.header('if-none-match');
  if (ifNoneMatch) {
    const normalized = normalizeETag(meta.etag);
    return ifNoneMatch === normalized || ifNoneMatch === '*';
  }

  const ifModifiedSince = req.header('if-modified-since');
  if (ifModifiedSince) {
    const clientDate = Date.parse(ifModifiedSince);
    const resourceDate = Date.parse(meta.lastModified);
    if (!Number.isNaN(clientDate) && !Number.isNaN(resourceDate)) {
      return resourceDate <= clientDate;
    }
  }

  return false;
}

// ── Response builders ──────────────────────────────────────────────────────────

function setCdnHeaders(
  res: Response,
  meta: Pick<ImageMetaCache, 'etag' | 'lastModified' | 'contentType' | 'contentLength'>,
): void {
  res.set('ETag', normalizeETag(meta.etag));
  res.set('Last-Modified', meta.lastModified);
  res.set('Cache-Control', IMAGE_CACHE_CONTROL);
  res.set('Surrogate-Control', IMAGE_SURROGATE_CONTROL);
  res.set('Vary', IMAGE_VARY);
  res.set('X-Public-Api-Version', PUBLIC_API_VERSION);
  res.set('Content-Type', meta.contentType || 'application/octet-stream');
  if (meta.contentLength != null) {
    res.set('Content-Length', String(meta.contentLength));
  }
}

function send304(res: Response, meta: Pick<ImageMetaCache, 'etag' | 'lastModified'>): void {
  res.set('ETag', normalizeETag(meta.etag));
  res.set('Last-Modified', meta.lastModified);
  res.set('Cache-Control', IMAGE_CACHE_CONTROL);
  res.set('X-Public-Api-Version', PUBLIC_API_VERSION);
  res.status(304).end();
}

function notFound(res: Response, reqId: string, message: string): void {
  res.status(404).json(
    PublicErrorPresenter.error({ code: 'PUBLIC_API_NOT_FOUND', message, status: 404 }, reqId),
  );
}

function badRequest(res: Response, reqId: string, message: string): void {
  res.status(400).json(
    PublicErrorPresenter.error({ code: 'PUBLIC_API_KEY_INVALID', message, status: 400 }, reqId),
  );
}

// ── Observabilidade ────────────────────────────────────────────────────────────

function emitMetrics(metrics: ImageProxyMetrics): void {
  logger.info('[ImageProxy]', {
    placaId: metrics.placaId,
    cacheStatus: metrics.cacheStatus,
    outcome: metrics.outcome,
    conditional: metrics.conditional,
    r2LatencyMs: metrics.r2LatencyMs,
    contentType: metrics.contentType,
    bytesSent: metrics.bytesSent,
  });
}

// ── R2 helpers ─────────────────────────────────────────────────────────────────

/** Busca metadata de um objeto R2 sem baixar o conteúdo (HeadObject). */
async function headR2Object(
  bucket: string,
  r2Key: string,
  updatedAt: string,
): Promise<Omit<ImageMetaCache, 'placaId' | 'r2Key' | 'updatedAt'>> {
  const client = getR2Client();
  if (!client) throw new Error('R2 client unavailable');

  const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));

  const etag = normalizeETag(res.ETag) || computeFallbackETag(r2Key, updatedAt);
  const lastModified = res.LastModified
    ? res.LastModified.toUTCString()
    : new Date(updatedAt).toUTCString();

  return {
    etag,
    lastModified,
    contentType: res.ContentType || 'application/octet-stream',
    contentLength: res.ContentLength,
  };
}

// ── Controller ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/public/placas/:id/imagem
 * GET /api/public/placas/:id/imagem
 *
 * Endpoint público (sem API key). Proxy seguro do R2 privado com suporte
 * completo a ETag, Last-Modified, 304 Not Modified e Redis cache.
 */
export async function getPlacaImagem(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const reqId = deriveRequestId(req);
  const isConditional = hasConditionalHeaders(req);
  const t0 = Date.now();

  // ── 1. Bloqueia query params de path livre ─────────────────────────────────
  for (const param of BLOCKED_QUERY_PARAMS) {
    if (req.query[param] !== undefined) {
      badRequest(res, reqId, `Query param "${param}" não é permitido neste endpoint.`);
      return;
    }
  }

  // ── 2. Valida id ───────────────────────────────────────────────────────────
  const idParam = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!idParam) {
    badRequest(res, reqId, 'Identificador inválido.');
    return;
  }

  const bucket = getR2BucketName();
  if (!bucket || !getR2Client()) {
    res.status(503).json(
      PublicErrorPresenter.error(
        { code: 'PUBLIC_API_INTERNAL_ERROR', message: 'Serviço de storage indisponível.', status: 503 },
        reqId,
      ),
    );
    return;
  }

  // ── 3. Redis cache lookup (fast path) ─────────────────────────────────────
  const redisAvailable = isImageCacheAvailable();
  let cachedMeta: ImageMetaCache | null = null;
  let cacheStatus: ImageProxyMetrics['cacheStatus'] = redisAvailable ? 'miss' : 'redis_unavailable';

  if (redisAvailable) {
    cachedMeta = await getImageMetaFromCache(idParam);
    if (cachedMeta) cacheStatus = 'hit';
  }

  // ── 4. Fast path: Redis hit ────────────────────────────────────────────────
  if (cachedMeta) {
    if (isConditional && isNotModified(req, cachedMeta)) {
      send304(res, cachedMeta);
      emitMetrics({
        placaId: idParam,
        cacheStatus: 'hit',
        outcome: 304,
        conditional: true,
        r2LatencyMs: null,
        contentType: null,
        bytesSent: null,
      });
      return;
    }

    // Cache hit mas precisa stream: GetObject sem HeadObject adicional
    await streamFromR2(req, res, reqId, idParam, cachedMeta, bucket, t0, 'hit');
    return;
  }

  // ── 5. Slow path: MongoDB lookup ───────────────────────────────────────────
  let doc: PlacaImageDoc | null = null;
  try {
    doc = await getPlacaDocForImagePublic(idParam);
  } catch {
    notFound(res, reqId, 'Placa não encontrada.');
    return;
  }

  if (!doc) {
    notFound(res, reqId, 'Placa não encontrada.');
    emitMetrics({ placaId: idParam, cacheStatus, outcome: 404, conditional: isConditional, r2LatencyMs: null, contentType: null, bytesSent: null });
    return;
  }

  const rawValue = resolveImageValue(doc);
  if (!rawValue) {
    notFound(res, reqId, 'Placa sem imagem cadastrada.');
    emitMetrics({ placaId: idParam, cacheStatus, outcome: 404, conditional: isConditional, r2LatencyMs: null, contentType: null, bytesSent: null });
    return;
  }

  const r2Key = extractR2Key(rawValue);
  if (!r2Key) {
    notFound(res, reqId, 'Imagem não disponível.');
    emitMetrics({ placaId: idParam, cacheStatus, outcome: 404, conditional: isConditional, r2LatencyMs: null, contentType: null, bytesSent: null });
    return;
  }

  const updatedAt =
    doc.updatedAt instanceof Date
      ? doc.updatedAt.toISOString()
      : typeof doc.updatedAt === 'string'
        ? doc.updatedAt
        : new Date().toISOString();

  // ── 6. Com conditional headers: HeadObject primeiro (barato) ───────────────
  if (isConditional) {
    let headMeta: Omit<ImageMetaCache, 'placaId' | 'r2Key' | 'updatedAt'>;
    const tHead = Date.now();

    try {
      headMeta = await headR2Object(bucket, r2Key, updatedAt);
    } catch (err: any) {
      const httpStatus: number = err?.$metadata?.httpStatusCode ?? 0;
      if (err?.name === 'NoSuchKey' || httpStatus === 404) {
        notFound(res, reqId, 'Imagem não encontrada no storage.');
        emitMetrics({ placaId: idParam, cacheStatus, outcome: 404, conditional: true, r2LatencyMs: Date.now() - tHead, contentType: null, bytesSent: null });
        return;
      }
      res.status(500).json(
        PublicErrorPresenter.error({ code: 'PUBLIC_API_INTERNAL_ERROR', message: 'Erro ao verificar imagem.', status: 500 }, reqId),
      );
      return;
    }

    const fullMeta: ImageMetaCache = { placaId: idParam, r2Key, updatedAt, ...headMeta };
    // Cache assíncrono — não bloqueia resposta
    void setImageMetaInCache(fullMeta);

    if (isNotModified(req, fullMeta)) {
      send304(res, fullMeta);
      emitMetrics({ placaId: idParam, cacheStatus, outcome: 304, conditional: true, r2LatencyMs: Date.now() - tHead, contentType: null, bytesSent: null });
      return;
    }

    // Não é 304 — faz GetObject com metadata já conhecida
    await streamFromR2(req, res, reqId, idParam, fullMeta, bucket, t0, cacheStatus);
    return;
  }

  // ── 7. Sem conditional headers: GetObject direto ──────────────────────────
  // Obtemos metadata do GetObject response e cacheamos (evita HeadObject extra)
  await streamFromR2WithMetaCapture(
    req, res, reqId, idParam, r2Key, updatedAt, bucket, t0, cacheStatus,
  );
}

/** Stream do R2 quando já temos a metadata (cache hit ou pós-HeadObject). */
async function streamFromR2(
  _req: Request,
  res: Response,
  reqId: string,
  placaId: string,
  meta: ImageMetaCache,
  bucket: string,
  t0: number,
  cacheStatus: ImageProxyMetrics['cacheStatus'],
): Promise<void> {
  const client = getR2Client()!;
  const tR2 = Date.now();

  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: meta.r2Key }),
    );

    if (!response.Body) {
      notFound(res, reqId, 'Objeto não encontrado no storage.');
      emitMetrics({ placaId, cacheStatus, outcome: 404, conditional: false, r2LatencyMs: Date.now() - tR2, contentType: null, bytesSent: null });
      return;
    }

    // Atualiza ETag/LastModified se R2 devolveu valores mais frescos
    const freshEtag = response.ETag ? normalizeETag(response.ETag) : meta.etag;
    const freshLastModified = response.LastModified
      ? response.LastModified.toUTCString()
      : meta.lastModified;

    const freshMeta: ImageMetaCache = {
      ...meta,
      etag: freshEtag,
      lastModified: freshLastModified,
      contentType: response.ContentType || meta.contentType,
      contentLength: response.ContentLength ?? meta.contentLength,
    };

    // Atualiza cache assincronamente
    void setImageMetaInCache(freshMeta);

    setCdnHeaders(res, freshMeta);

    const stream = response.Body as unknown as Readable;
    stream.on('error', () => {
      if (!res.headersSent) notFound(res, reqId, 'Erro ao transmitir imagem.');
      else res.destroy();
    });

    const bytesSent = freshMeta.contentLength ?? null;
    emitMetrics({ placaId, cacheStatus, outcome: 200, conditional: false, r2LatencyMs: Date.now() - tR2, contentType: freshMeta.contentType, bytesSent });
    stream.pipe(res);
  } catch (err: any) {
    handleR2Error(err, res, reqId, placaId, cacheStatus, t0);
  }
}

/**
 * Stream do R2 quando ainda não temos metadata (primeira request sem conditional headers).
 * Captura ETag/LastModified do GetObject response e popula o Redis.
 */
async function streamFromR2WithMetaCapture(
  _req: Request,
  res: Response,
  reqId: string,
  placaId: string,
  r2Key: string,
  updatedAt: string,
  bucket: string,
  t0: number,
  cacheStatus: ImageProxyMetrics['cacheStatus'],
): Promise<void> {
  const client = getR2Client()!;
  const tR2 = Date.now();

  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: r2Key }),
    );

    if (!response.Body) {
      notFound(res, reqId, 'Objeto não encontrado no storage.');
      emitMetrics({ placaId, cacheStatus, outcome: 404, conditional: false, r2LatencyMs: Date.now() - tR2, contentType: null, bytesSent: null });
      return;
    }

    const etag = response.ETag
      ? normalizeETag(response.ETag)
      : computeFallbackETag(r2Key, updatedAt);
    const lastModified = response.LastModified
      ? response.LastModified.toUTCString()
      : new Date(updatedAt).toUTCString();
    const contentType = response.ContentType || 'application/octet-stream';
    const contentLength = response.ContentLength;

    const meta: ImageMetaCache = {
      placaId,
      r2Key,
      etag,
      lastModified,
      contentType,
      contentLength,
      updatedAt,
    };

    // Popula Redis assincronamente — não bloqueia stream
    void setImageMetaInCache(meta);

    setCdnHeaders(res, meta);

    const stream = response.Body as unknown as Readable;
    stream.on('error', () => {
      if (!res.headersSent) notFound(res, reqId, 'Erro ao transmitir imagem.');
      else res.destroy();
    });

    emitMetrics({ placaId, cacheStatus, outcome: 200, conditional: false, r2LatencyMs: Date.now() - tR2, contentType, bytesSent: contentLength ?? null });
    stream.pipe(res);
  } catch (err: any) {
    handleR2Error(err, res, reqId, placaId, cacheStatus, t0);
  }
}

function handleR2Error(
  err: any,
  res: Response,
  reqId: string,
  placaId: string,
  cacheStatus: ImageProxyMetrics['cacheStatus'],
  t0: number,
): void {
  const httpStatus: number = err?.$metadata?.httpStatusCode ?? 0;
  if (err?.name === 'NoSuchKey' || httpStatus === 404) {
    notFound(res, reqId, 'Imagem não encontrada no storage.');
    emitMetrics({ placaId, cacheStatus, outcome: 404, conditional: false, r2LatencyMs: Date.now() - t0, contentType: null, bytesSent: null });
    return;
  }
  res.status(500).json(
    PublicErrorPresenter.error(
      { code: 'PUBLIC_API_INTERNAL_ERROR', message: 'Erro ao buscar imagem.', status: 500 },
      reqId,
    ),
  );
  emitMetrics({ placaId, cacheStatus, outcome: 500, conditional: false, r2LatencyMs: Date.now() - t0, contentType: null, bytesSent: null });
}
