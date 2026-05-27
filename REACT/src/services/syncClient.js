/**
 * Sync HTTP Client — COMM-3
 *
 * COMM-6: cursor canônico.
 *   fetchSyncEvents envia ?cursor=<base64> (canônico) ou ?since=<iso> (legado).
 *   buildStreamUrl inclui cursor canônico na URL do EventSource.
 */

import apiClient from './apiClient';
import { API_V1_BASE_URL } from '../utils/config';
import { serializeCursor } from '../contracts';

/**
 * GET /api/v1/sync/status (público — sem autenticação)
 * @returns {Promise<import('../contracts').SyncStatus>}
 */
export async function fetchSyncStatus() {
  const response = await apiClient.get('/sync/status', { isPublic: true });
  return response.data?.data ?? response.data;
}

/**
 * GET /api/v1/sync/snapshot (autenticado)
 * @returns {Promise<import('../contracts').SyncSnapshot>}
 */
export async function fetchSyncSnapshot() {
  const response = await apiClient.get('/sync/snapshot');
  return response.data?.data ?? response.data;
}

/**
 * GET /api/v1/sync/events (autenticado)
 *
 * COMM-6: cursor canônico enviado como ?cursor=<base64url>.
 *   Cursor string legado enviado como ?since=<iso> para compat com backends antigos.
 *
 * @param {import('../contracts').SyncCursor|string|null} [cursor]
 * @returns {Promise<import('../contracts').SyncEventsResponse>}
 */
export async function fetchSyncEvents(cursor) {
  let params = '';
  if (cursor) {
    if (typeof cursor === 'object') {
      // Cursor canônico → serializa para base64url
      const serialized = serializeCursor(cursor);
      if (serialized) params = `?cursor=${encodeURIComponent(serialized)}`;
    } else {
      // Cursor legado string → mantém compat via ?since=
      params = `?since=${encodeURIComponent(cursor)}`;
    }
  }
  const response = await apiClient.get(`/sync/events${params}`);
  return response.data?.data ?? response.data;
}

/**
 * POST /api/v1/sync/stream-token (autenticado)
 * Troca o JWT por um token efêmero (60s) para autenticar o EventSource.
 * @returns {Promise<{ token: string, expiresAt: string, ttlMs: number }>}
 */
export async function fetchStreamToken() {
  const response = await apiClient.post('/sync/stream-token', {});
  return response.data?.data ?? response.data;
}

/**
 * Retorna a URL completa para o EventSource SSE.
 * Não usa apiClient pois EventSource não aceita headers customizados.
 *
 * COMM-6: cursor canônico enviado como ?cursor=<base64url>.
 *
 * @param {string} token - streamToken emitido por fetchStreamToken()
 * @param {import('../contracts').SyncCursor|string|null} [cursor]
 * @returns {string} URL completa
 */
export function buildStreamUrl(token, cursor) {
  const base = API_V1_BASE_URL.replace(/\/$/, '');
  const params = new URLSearchParams({ token });

  if (cursor) {
    if (typeof cursor === 'object') {
      const serialized = serializeCursor(cursor);
      if (serialized) params.set('cursor', serialized);
    } else if (typeof cursor === 'string' && cursor.length > 0) {
      params.set('since', cursor);
    }
  }

  return `${base}/sync/stream?${params.toString()}`;
}
