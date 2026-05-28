/**
 * Cache Redis para metadata de imagem de placa (proxy público).
 *
 * TTL curto (120s) para equilibrar:
 * - evitar lookup MongoDB a cada request
 * - refletir atualizações de imagem sem delay longo
 *
 * Nunca lança exceções — fallback silencioso quando Redis está indisponível.
 * Nunca armazena payloads inseguros (sem r2Key exposto ao cliente).
 */

import cacheService from '@shared/container/cache.service';
import { redisManager } from '@shared/infra/redis/redis-manager';
import logger from '@shared/container/logger';
import type { ImageMetaCache } from './image-meta.types';

const IMAGE_META_TTL = 120; // 2 minutos
const KEY_PREFIX = 'img:placa:';

function cacheKey(placaId: string): string {
  return `${KEY_PREFIX}${placaId}`;
}

function isValidMeta(v: unknown): v is ImageMetaCache {
  if (!v || typeof v !== 'object') return false;
  const m = v as Partial<ImageMetaCache>;
  return (
    typeof m.placaId === 'string' &&
    typeof m.r2Key === 'string' &&
    typeof m.etag === 'string' &&
    typeof m.lastModified === 'string' &&
    typeof m.contentType === 'string' &&
    m.r2Key.length > 0 &&
    m.etag.length > 0
  );
}

/**
 * Busca metadata de imagem no Redis.
 * Retorna null em caso de miss, dado inválido ou Redis indisponível.
 */
export async function getImageMetaFromCache(
  placaId: string,
): Promise<ImageMetaCache | null> {
  if (!redisManager.isConnected()) return null;
  try {
    const raw = await cacheService.get(cacheKey(placaId));
    if (!isValidMeta(raw)) return null;
    logger.debug(`[ImageCache] HIT placaId=${placaId}`);
    return raw;
  } catch {
    logger.debug(`[ImageCache] get error — cache miss para placaId=${placaId}`);
    return null;
  }
}

/**
 * Salva metadata de imagem no Redis com TTL de 120s.
 * Fire-and-forget — nunca bloqueia o response.
 */
export async function setImageMetaInCache(meta: ImageMetaCache): Promise<void> {
  try {
    await cacheService.set(cacheKey(meta.placaId), meta, IMAGE_META_TTL);
    logger.debug(`[ImageCache] SET placaId=${meta.placaId} TTL=${IMAGE_META_TTL}s`);
  } catch {
    // Redis indisponível — tolerável, próxima request faz Mongo+R2
  }
}

/**
 * Invalida metadata de imagem (ex: após upload de nova imagem).
 */
export async function invalidateImageMetaCache(placaId: string): Promise<void> {
  try {
    await cacheService.del(cacheKey(placaId));
    logger.debug(`[ImageCache] INVALIDATED placaId=${placaId}`);
  } catch {
    // Redis indisponível — tolerável
  }
}

/** Verifica se o Redis está disponível (observabilidade). */
export function isImageCacheAvailable(): boolean {
  return cacheService.isAvailable();
}
