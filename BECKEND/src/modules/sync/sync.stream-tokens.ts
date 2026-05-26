/**
 * Stream Token Store — COMM-3
 *
 * Emite tokens de curta duração (60s) para autenticar conexões SSE.
 *
 * Por que não usar o JWT principal na URL:
 *   - JWT na URL aparece em logs de servidor, histório do browser e proxies.
 *   - Tokens efêmeros limitam a janela de exposição.
 *
 * Fluxo:
 *   1. Cliente autenticado faz POST /sync/stream-token (com Authorization: Bearer)
 *   2. Backend emite streamToken com expiresAt = now + TTL_MS
 *   3. Cliente abre EventSource("/sync/stream?token=<streamToken>")
 *   4. Backend valida o streamToken e troca pelo empresaId/userId
 *   5. Token é invalidado após uso (one-shot) ou expiração
 */

import { randomBytes } from 'crypto';
import { Log } from '@shared/core';

const TTL_MS = 60_000; // 60 segundos

interface StreamTokenEntry {
  empresaId: string;
  userId: string;
  expiresAt: number;
  used: boolean;
}

/** Map de token → metadata */
const tokenStore = new Map<string, StreamTokenEntry>();

/** Limpeza periódica de tokens expirados */
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [token, entry] of tokenStore) {
    if (entry.expiresAt < now || entry.used) {
      tokenStore.delete(token);
      removed++;
    }
  }
  if (removed > 0) {
    Log.info(`[StreamTokenStore] ${removed} token(s) expirado(s) removido(s)`);
  }
}, 30_000).unref(); // .unref() impede que o timer bloqueie o exit do processo

/**
 * Emite um stream token para a empresa/usuário.
 * @returns token string e expiresAt ISO
 */
export function issueStreamToken(empresaId: string, userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TTL_MS;

  tokenStore.set(token, { empresaId, userId, expiresAt, used: false });

  Log.info(`[StreamTokenStore] Token emitido para empresa=${empresaId} user=${userId}`);

  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * Valida e consome um stream token (one-shot).
 * Retorna null se inválido/expirado/já usado.
 */
export function consumeStreamToken(token: string): { empresaId: string; userId: string } | null {
  const entry = tokenStore.get(token);

  if (!entry) {
    Log.warn('[StreamTokenStore] Token não encontrado');
    return null;
  }
  if (entry.used) {
    Log.warn('[StreamTokenStore] Token já utilizado');
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    tokenStore.delete(token);
    Log.warn('[StreamTokenStore] Token expirado');
    return null;
  }

  // Marca como usado — one-shot
  entry.used = true;

  Log.info(`[StreamTokenStore] Token consumido para empresa=${entry.empresaId}`);
  return { empresaId: entry.empresaId, userId: entry.userId };
}

/** Para testes: limpa todos os tokens */
export function clearAllStreamTokens(): void {
  tokenStore.clear();
}

/** Para testes: conta tokens ativos */
export function countActiveTokens(): number {
  const now = Date.now();
  let count = 0;
  for (const entry of tokenStore.values()) {
    if (!entry.used && entry.expiresAt >= now) count++;
  }
  return count;
}
