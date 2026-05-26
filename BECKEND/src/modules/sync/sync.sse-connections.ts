/**
 * SSE Connection Registry — COMM-3
 *
 * COMM-7: SSE id normalizado.
 *   O campo `id:` de cada frame SSE usa `event.occurredAt` (ISO timestamp) em vez
 *   de `event.id` (UUID). Isso torna o Last-Event-ID enviado pelo browser no
 *   reconect diretamente utilizável como cursor ISO → parseCursor() → replay.
 *
 *   Em streams mode, o cursorValue pode ser o Redis stream ID — passado pelo
 *   chamador quando disponível via pushEventToTenant(event, cursorValue).
 *
 * Mantém as conexões SSE ativas, agrupadas por empresaId.
 */

import { Response } from 'express';
import { Log } from '@shared/core';
import { inc, recordSseDelivery } from './sync.metrics';
import type { SyncEvent } from './sync.types';

/** Identificador único de conexão */
let _nextId = 1;

interface SSEConnection {
  id: number;
  empresaId: string;
  userId: string;
  res: Response;
  connectedAt: string;
}

/** Map de empresaId → Set de conexões */
const connections = new Map<string, Set<SSEConnection>>();

const MAX_CONNECTIONS_PER_TENANT = 50;

// ─── Gestão de conexões ───────────────────────────────────────────────────────

/**
 * Registra uma nova conexão SSE para uma empresa.
 * Retorna o id da conexão e uma função de cleanup.
 */
export function registerConnection(
  empresaId: string,
  userId: string,
  res: Response,
): { connId: number; cleanup: () => void } {
  if (!connections.has(empresaId)) {
    connections.set(empresaId, new Set());
  }

  const tenantConns = connections.get(empresaId)!;

  if (tenantConns.size >= MAX_CONNECTIONS_PER_TENANT) {
    Log.warn(`[SSEConnections] Limite de conexões atingido para empresa=${empresaId}`);
    return { connId: -1, cleanup: () => {} };
  }

  const conn: SSEConnection = {
    id:          _nextId++,
    empresaId,
    userId,
    res,
    connectedAt: new Date().toISOString(),
  };

  tenantConns.add(conn);
  Log.info(`[SSEConnections] CONNECT id=${conn.id} empresa=${empresaId} user=${userId} (total tenant: ${tenantConns.size})`);

  const cleanup = () => removeConnection(empresaId, conn);

  return { connId: conn.id, cleanup };
}

function removeConnection(empresaId: string, conn: SSEConnection): void {
  const tenantConns = connections.get(empresaId);
  if (!tenantConns) return;

  tenantConns.delete(conn);
  Log.info(`[SSEConnections] DISCONNECT id=${conn.id} empresa=${empresaId} (total tenant: ${tenantConns.size})`);

  if (tenantConns.size === 0) {
    connections.delete(empresaId);
  }
}

// ─── Push de eventos ──────────────────────────────────────────────────────────

/**
 * Envia um SyncEvent para todos os clientes SSE da empresa.
 *
 * COMM-7: SSE id normalizado.
 *   cursorValue (opcional) — valor a usar como `id:` no frame SSE.
 *   Se não fornecido, usa event.occurredAt (ISO cursor válido para replay).
 *   Em streams mode, o chamador pode passar o Redis stream ID como cursorValue.
 *
 *   O browser enviará este valor como Last-Event-ID no reconect, permitindo
 *   que o backend use parseCursor() → replay consistente.
 */
export function pushEventToTenant(
  empresaId: string,
  event: SyncEvent,
  cursorValue?: string,
): void {
  const tenantConns = connections.get(empresaId);
  if (!tenantConns || tenantConns.size === 0) return;

  // COMM-7: usa occurredAt como SSE id padrão (replay-safe via parseCursor ISO)
  const sseId  = cursorValue ?? event.occurredAt;
  const data   = JSON.stringify(event);
  const message = `id: ${sseId}\nevent: ${event.type}\ndata: ${data}\n\n`;

  const dead: SSEConnection[] = [];

  for (const conn of tenantConns) {
    try {
      conn.res.write(message);
    } catch {
      dead.push(conn);
    }
  }

  dead.forEach(c => removeConnection(empresaId, c));

  const delivered = tenantConns.size;
  if (delivered > 0) {
    inc('eventsDeliveredSSE', delivered); // COMM-7: métrica por clientes entregues
    recordSseDelivery(event.id, event.occurredAt);
    Log.info(`[SSEConnections] Evento ${event.type} entregue para ${delivered} cliente(s) empresa=${empresaId} sseId=${sseId} correlationId=${event.correlationId}`);
  }
}

/**
 * Envia heartbeat para todos os clientes de todas as empresas.
 * Evita que proxies/firewalls fechem conexões idle.
 */
export function sendHeartbeatToAll(): void {
  const now = new Date().toISOString();
  const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({ serverTime: now })}\n\n`;

  for (const [empresaId, tenantConns] of connections) {
    const dead: SSEConnection[] = [];
    for (const conn of tenantConns) {
      try {
        conn.res.write(heartbeat);
      } catch {
        dead.push(conn);
      }
    }
    dead.forEach(c => removeConnection(empresaId, c));
  }
}

// Heartbeat a cada 25s (abaixo do timeout padrão de proxies de 30s)
setInterval(sendHeartbeatToAll, 25_000).unref();

// ─── Métricas ─────────────────────────────────────────────────────────────────

export function countConnectionsForTenant(empresaId: string): number {
  return connections.get(empresaId)?.size ?? 0;
}

export function totalConnections(): number {
  let total = 0;
  for (const set of connections.values()) total += set.size;
  return total;
}

/** Retorna lista das empresaIds com conexões ativas. */
export function getConnectedTenants(): string[] {
  return Array.from(connections.keys());
}

/** Para testes: limpa todas as conexões */
export function clearAllConnections(): void {
  connections.clear();
}
