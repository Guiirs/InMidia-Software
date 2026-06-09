/**
 * Proxy público de imagem de placa — enterprise-grade, CDN-ready.
 *
 * FONTE ÚNICA DE VERDADE: PlateMedia.activeKey
 * Não há fallback para campos legados (imagemPrincipal, imagem, imagens[]).
 * Se PlateMedia não existir para a placa, retorna 404.
 *
 * Segurança:
 *   - Sem autenticação (público para WordPress/JetEngine)
 *   - Rate limiting por IP (publicApiRateLimiter)
 *   - ?path= / ?key= / ?url= / ?src= / ?file= → 400
 *   - Chave R2 extraída só do PlateMedia; traversal impossível
 *   - Credenciais, keys internas e stack traces nunca expostos
 *
 * CDN / Conditional Cache:
 *   - ETag (R2 nativo via HeadObject; fallback SHA-256 de key+version)
 *   - Last-Modified (R2 LastModified ou PlateMedia.version)
 *   - If-None-Match → 304 sem rebuscar stream
 *   - If-Modified-Since → 304 sem rebuscar stream
 *   - Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400
 *   - ?v= query param (PlateMedia.version) para cache-busting no browser
 *
 * Performance:
 *   - Redis cache de metadata (TTL 120s) → zero lookups MongoDB ou R2 para 304
 *   - Com conditional headers + Redis hit: 304 sem NENHUMA chamada R2
 *   - Streaming puro sem bufferização
 *
 * Observabilidade:
 *   - Log estruturado ao final de cada request (cacheStatus, outcome, latência, bytes)
 */

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';
import { Types } from 'mongoose';
import { PublicErrorPresenter } from '@modules/public-api/presenters/public-error.presenter';
import { getR2Client, getR2BucketName } from '@shared/infra/storage/r2-client';
import { publicMediaRateLimiter } from '@shared/infra/http/middlewares/rate-limit.middleware';
import logger from '@shared/container/logger';
import {
  getImageMetaFromCache,
  setImageMetaInCache,
  setImageNotFound,
  isImageCacheAvailable,
} from './image-cache.service';
import type { ImageMetaCache, ImageProxyMetrics } from './image-meta.types';
import { plateMediaService } from '@modules/media/plate-media.service';
import Placa from '@modules/placas/Placa';

export { publicMediaRateLimiter as imageRateLimiter };

// ── Constantes ─────────────────────────────────────────────────────────────────

const IMAGE_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400';
const IMAGE_SURROGATE_CONTROL = 'max-age=604800';
const IMAGE_VARY = 'Accept-Encoding';
const PUBLIC_API_VERSION = 'v1';
const PUBLIC_IMAGE_CORP = 'cross-origin';
const PUBLIC_IMAGE_CORS_ORIGIN = '*';

// ?v= é permitido (cache-busting) — apenas estes são bloqueados.
const BLOCKED_QUERY_PARAMS = ['path', 'key', 'file', 'url', 'src'];

export function publicImageSecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Access-Control-Allow-Origin', PUBLIC_IMAGE_CORS_ORIGIN);
  res.setHeader('Cross-Origin-Resource-Policy', PUBLIC_IMAGE_CORP);
  res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
  next();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveRequestId(req: Request): string {
  return req.header('x-request-id') ?? 'unknown';
}

/** ETag fallback: SHA-256(r2Key + version), estável e barato. */
function computeFallbackETag(r2Key: string, version: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(r2Key)
    .update(version)
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
  res.set('Access-Control-Allow-Origin', PUBLIC_IMAGE_CORS_ORIGIN);
  res.set('Cross-Origin-Resource-Policy', PUBLIC_IMAGE_CORP);
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
  res.set('Access-Control-Allow-Origin', PUBLIC_IMAGE_CORS_ORIGIN);
  res.set('Cross-Origin-Resource-Policy', PUBLIC_IMAGE_CORP);
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
  version: string,
): Promise<Omit<ImageMetaCache, 'placaId' | 'r2Key' | 'updatedAt'>> {
  const client = getR2Client();
  if (!client) throw new Error('R2 client unavailable');

  const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));

  const etag = normalizeETag(res.ETag) || computeFallbackETag(r2Key, version);
  const lastModified = res.LastModified
    ? res.LastModified.toUTCString()
    : new Date(parseInt(version || '0', 10) || Date.now()).toUTCString();

  return {
    etag,
    lastModified,
    contentType: res.ContentType || 'application/octet-stream',
    contentLength: res.ContentLength,
  };
}

// ── Controller ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/public/media/plates/:id/main
 * GET /api/v1/public/placas/:id/imagem  (alias legado)
 *
 * Endpoint público (sem API key). Proxy seguro do R2 privado.
 * Aceita ?v={PlateMedia.version} para cache-busting — parâmetro ignorado internamente,
 * sua presença na URL garante que o browser não use cache de versão anterior.
 */
export async function getPlacaImagem(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const reqId = deriveRequestId(req);
  const isConditional = hasConditionalHeaders(req);
  const t0 = Date.now();

  // ── 1. Bloqueia query params de path livre (segurança) ────────────────────
  for (const param of BLOCKED_QUERY_PARAMS) {
    if (req.query[param] !== undefined) {
      badRequest(res, reqId, `Query param "${param}" não é permitido neste endpoint.`);
      return;
    }
  }

  // ── 2. Valida id ──────────────────────────────────────────────────────────
  const idParam = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!idParam) {
    badRequest(res, reqId, 'Identificador inválido.');
    return;
  }
  if (!Types.ObjectId.isValid(idParam)) {
    notFound(res, reqId, 'Placa não encontrada.');
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

  const publicPlate = await Placa.findOne({ _id: idParam, statusOperacional: { $ne: 'ARCHIVED' } })
    .select('_id empresaId statusOperacional')
    .lean();
  const empresaId = publicPlate?.empresaId ? String((publicPlate as any).empresaId) : null;
  if (!empresaId) {
    notFound(res, reqId, 'Placa não encontrada.');
    return;
  }

  // ── 3. Redis cache lookup (fast path) ────────────────────────────────────
  const redisAvailable = isImageCacheAvailable();
  let cachedMeta: ImageMetaCache | null = null;
  let cacheStatus: ImageProxyMetrics['cacheStatus'] = redisAvailable ? 'miss' : 'redis_unavailable';

  if (redisAvailable) {
    cachedMeta = await getImageMetaFromCache(idParam);
    if (cachedMeta) cacheStatus = 'hit';
  }

  // ── 4. Fast path: Redis hit ───────────────────────────────────────────────
  if (cachedMeta) {
    if (isConditional && isNotModified(req, cachedMeta)) {
      send304(res, cachedMeta);
      emitMetrics({ placaId: idParam, cacheStatus: 'hit', outcome: 304, conditional: true, r2LatencyMs: null, contentType: null, bytesSent: null });
      return;
    }
    await streamFromR2(res, reqId, idParam, cachedMeta, bucket, t0, 'hit');
    return;
  }

  // ── 5. Slow path: resolver r2Key via PlateMedia (única fonte canônica) ────
  const pmResolution = await plateMediaService.resolvePlateMainImage(idParam, empresaId);

  if (!pmResolution.hasImage || !pmResolution.activeKey) {
    notFound(res, reqId, 'Placa sem imagem cadastrada.');
    logger.info('[ImageProxy] PlateMedia sem activeKey', { placaId: idParam });
    emitMetrics({ placaId: idParam, cacheStatus, outcome: 404, conditional: isConditional, r2LatencyMs: null, contentType: null, bytesSent: null });
    return;
  }

  // Usa effectiveKey (WebP otimizado quando webpEnabled=true, senão original).
  // O Content-Type correto é definido pelo objeto R2 via HeadObject/GetObject.
  const r2Key = pmResolution.effectiveKey ?? pmResolution.activeKey;
  // version é um timestamp ms string — serve como proxy de updatedAt para ETag fallback
  const version = pmResolution.version || String(Date.now());

  logger.info('[ImageProxy] resolução via PlateMedia', {
    placaId: idParam,
    tentativaR2: `${bucket}/${r2Key}`,
    webpEnabled: pmResolution.effectiveKey !== pmResolution.activeKey,
  });

  // ── 6. Com conditional headers: HeadObject primeiro (barato) ─────────────
  if (isConditional) {
    const tHead = Date.now();
    try {
      const headMeta = await headR2Object(bucket, r2Key, version);
      const fullMeta: ImageMetaCache = { placaId: idParam, r2Key, updatedAt: version, ...headMeta };
      void setImageMetaInCache(fullMeta);

      if (isNotModified(req, fullMeta)) {
        send304(res, fullMeta);
        emitMetrics({ placaId: idParam, cacheStatus, outcome: 304, conditional: true, r2LatencyMs: Date.now() - tHead, contentType: null, bytesSent: null });
        return;
      }

      await streamFromR2(res, reqId, idParam, fullMeta, bucket, t0, cacheStatus);
    } catch (err: any) {
      handleR2Error(err, res, reqId, idParam, r2Key, bucket, cacheStatus, t0);
    }
    return;
  }

  // ── 7. Sem conditional headers: GetObject direto ──────────────────────────
  await streamFromR2WithMetaCapture(res, reqId, idParam, r2Key, version, bucket, t0, cacheStatus);
}

/** Stream do R2 quando já temos a metadata (cache hit ou pós-HeadObject). */
async function streamFromR2(
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

    void setImageMetaInCache(freshMeta);
    setCdnHeaders(res, freshMeta);

    const stream = response.Body as unknown as Readable;
    stream.on('error', () => {
      if (!res.headersSent) notFound(res, reqId, 'Erro ao transmitir imagem.');
      else res.destroy();
    });

    emitMetrics({ placaId, cacheStatus, outcome: 200, conditional: false, r2LatencyMs: Date.now() - tR2, contentType: freshMeta.contentType, bytesSent: freshMeta.contentLength ?? null });
    stream.pipe(res);
  } catch (err: any) {
    handleR2Error(err, res, reqId, placaId, meta.r2Key, bucket, cacheStatus, t0);
  }
}

/**
 * Stream do R2 quando ainda não temos metadata (primeira request sem conditional headers).
 * Captura ETag/LastModified do GetObject response e popula o Redis.
 */
async function streamFromR2WithMetaCapture(
  res: Response,
  reqId: string,
  placaId: string,
  r2Key: string,
  version: string,
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
      : computeFallbackETag(r2Key, version);
    const lastModified = response.LastModified
      ? response.LastModified.toUTCString()
      : new Date(parseInt(version || '0', 10) || Date.now()).toUTCString();
    const contentType = response.ContentType || 'application/octet-stream';
    const contentLength = response.ContentLength;

    const meta: ImageMetaCache = { placaId, r2Key, etag, lastModified, contentType, contentLength, updatedAt: version };
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
    handleR2Error(err, res, reqId, placaId, r2Key, bucket, cacheStatus, t0);
  }
}

function handleR2Error(
  err: any,
  res: Response,
  reqId: string,
  placaId: string,
  r2Key: string,
  bucket: string,
  cacheStatus: ImageProxyMetrics['cacheStatus'],
  t0: number,
): void {
  const httpStatus: number = err?.$metadata?.httpStatusCode ?? 0;
  if (err?.name === 'NoSuchKey' || httpStatus === 404) {
    notFound(res, reqId, 'Imagem não encontrada no storage.');
    void setImageNotFound(placaId);
    logger.warn('[ImageProxy] R2 NoSuchKey', {
      placaId,
      bucket,
      r2Key,
      errorName: err?.name ?? null,
      httpStatus,
    });
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
