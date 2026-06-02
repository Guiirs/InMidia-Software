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

// ── Negative cache ─────────────────────────────────────────────────────────────
// Marca placas cujo arquivo não existe no R2. TTL curto para se auto-reparar
// após upload real do arquivo.

const NOT_FOUND_KEY_PREFIX = 'img:placa:nf:';
const NOT_FOUND_TTL = 300; // 5 minutos

function notFoundCacheKey(placaId: string): string {
  return `${NOT_FOUND_KEY_PREFIX}${placaId}`;
}

/**
 * Marca a imagem de uma placa como "não encontrada no storage".
 * Chamado pelo proxy ao receber NoSuchKey do R2.
 * Após upload real do arquivo a listagem se corrige quando o TTL expirar.
 */
export async function setImageNotFound(placaId: string): Promise<void> {
  if (!redisManager.isConnected()) return;
  try {
    await cacheService.set(notFoundCacheKey(placaId), 1, NOT_FOUND_TTL);
    logger.debug(`[ImageCache] NOT_FOUND placaId=${placaId} TTL=${NOT_FOUND_TTL}s`);
  } catch {
    // non-fatal
  }
}

/**
 * Retorna true se a imagem desta placa está marcada como não encontrada.
 * Usado pela listagem para manter consistência com o proxy.
 */
async function isImageNotFound(placaId: string): Promise<boolean> {
  if (!redisManager.isConnected()) return false;
  try {
    const val = await cacheService.get(notFoundCacheKey(placaId));
    return val === 1 || val === true;
  } catch {
    return false;
  }
}

/**
 * Batch check: retorna o Set de IDs de placas marcadas como not-found.
 * Chamado pela listagem para sobrescrever hasImage antes de emitir a resposta.
 */
export async function batchIsImageNotFound(placaIds: string[]): Promise<Set<string>> {
  if (!redisManager.isConnected() || placaIds.length === 0) return new Set();
  try {
    const results = await Promise.all(placaIds.map((id) => isImageNotFound(id)));
    return new Set(placaIds.filter((_, i) => results[i]));
  } catch {
    return new Set();
  }
}

/**
 * Remove a marca de not-found (ex: após upload bem-sucedido de nova imagem).
 */
export async function clearImageNotFound(placaId: string): Promise<void> {
  if (!redisManager.isConnected()) return;
  try {
    await cacheService.del(notFoundCacheKey(placaId));
    logger.debug(`[ImageCache] NOT_FOUND cleared placaId=${placaId}`);
  } catch {
    // non-fatal
  }
}
