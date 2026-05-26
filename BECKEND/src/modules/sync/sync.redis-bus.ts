/**
 * Sync Redis Bus — COMM-5
 *
 * Melhorias sobre COMM-4:
 *   - Reconexão automática com backoff exponencial (pub e sub)
 *   - Suporte a Redis Streams (SYNC_REDIS_MODE=streams)
 *   - Métricas ricas: reconnectAttempts, lastErrorAt, lastErrorMessage, degraded
 *   - Isolamento multi-tenant preservado em ambos os modos
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * MODOS:
 *
 *   pubsub  (default)
 *     Publisher:  PUBLISH sync:events:<empresaId> <json>
 *     Subscriber: PSUBSCRIBE sync:events:*
 *     Replay:     buffer em memória local (por instância)
 *
 *   streams
 *     Writer:  XADD sync:stream:<empresaId> MAXLEN ~ MAXLEN * <fields>
 *     Reader:  XREAD COUNT N STREAMS sync:stream:<empresaId> <cursor>
 *     PubSub ainda é usado para push imediato (zero-latency SSE).
 *     Replay cross-instância via XREAD — cursor baseado em stream ID.
 *     Retenção configurável via SYNC_STREAM_MAXLEN.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * RECONEXÃO (COMM-5):
 *   Backoff exponencial: 1s → 2s → 4s → 8s → 16s (max).
 *   Após MAX_RECONNECT_ATTEMPTS (default 10), entra em modo degraded.
 *   Modo degraded: SSE local e polling local continuam; Redis é desabilitado
 *   temporariamente até próximo restart ou call manual a reconnect().
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ANTI-ECO:
 *   Cada processo carrega INSTANCE_ID (UUID gerado no boot).
 *   Eventos publicados por esta instância carregam _originInstanceId.
 *   Ao receber mensagem PubSub, descarta se _originInstanceId === INSTANCE_ID.
 *   Em Streams: apenas eventos de OUTRAS instâncias são armazenados/entregues.
 */

import { randomUUID } from 'crypto';
import { createClient } from 'redis';
import { Log } from '@shared/core';
import { inc } from './sync.metrics';
import { recordDiagnostic } from './sync.diagnostics-buffer';
import type { SyncEvent } from './sync.types';

// ─── Configuração ─────────────────────────────────────────────────────────────

const SYNC_REDIS_ENABLED    = process.env.SYNC_REDIS_ENABLED === 'true';
const REDIS_URL             = process.env.REDIS_URL || 'redis://localhost:6379';
const CHANNEL_PREFIX        = process.env.SYNC_REDIS_CHANNEL_PREFIX || 'sync:events';
const STREAM_PREFIX         = 'sync:stream';
const SYNC_REDIS_MODE_ENV   = (process.env.SYNC_REDIS_MODE || 'pubsub') as 'pubsub' | 'streams';
const STREAM_MAXLEN         = parseInt(process.env.SYNC_STREAM_MAXLEN || '5000', 10);
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_MS      = 1_000;
const RECONNECT_MAX_MS       = 16_000;

export const INSTANCE_ID: string = randomUUID();

// ─── Estado interno ───────────────────────────────────────────────────────────

type RedisClient = ReturnType<typeof createClient>;

export type TransportMode = 'local-only' | 'redis-pubsub' | 'redis-streams';

let pubClient:    RedisClient | null = null;
let subClient:    RedisClient | null = null;
let _initialized: boolean            = false;
let _connected:   boolean            = false;
let _degraded:    boolean            = false;
let _mode:        TransportMode      = 'local-only';

// Métricas de reconexão
let _reconnectAttempts:    number      = 0;
let _lastErrorAt:          string|null = null;
let _lastErrorMessage:     string|null = null;
let _reconnectTimer:       ReturnType<typeof setTimeout>|null = null;

// COMM-7: deduplicação com TTL explícito (Map<id, timestampMs>)
// Evita crescimento infinito e permite evicção por idade + tamanho.
const _remoteProcessed = new Map<string, number>();
const MAX_REMOTE_SEEN  = 1_000;
const DEDUP_TTL_MS     = 5 * 60_000; // 5 minutos

// COMM-6: último stream ID conhecido por empresa (capturado no XADD)
const _lastStreamIdByEmpresa = new Map<string, string>();

// ─── Lazy imports ─────────────────────────────────────────────────────────────

let _sseModule: typeof import('./sync.sse-connections') | null = null;
async function getSseModule() {
  if (!_sseModule) _sseModule = await import('./sync.sse-connections');
  return _sseModule;
}

let _registryModule: typeof import('./sync.registry') | null = null;
async function getRegistryModule() {
  if (!_registryModule) _registryModule = await import('./sync.registry');
  return _registryModule;
}

// ─── Envelope PubSub ─────────────────────────────────────────────────────────

interface RedisEventEnvelope extends SyncEvent {
  _originInstanceId: string;
}

// ─── Inicialização ────────────────────────────────────────────────────────────

export async function initialize(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  if (!SYNC_REDIS_ENABLED) {
    Log.info('[SyncRedisBus] SYNC_REDIS_ENABLED=false → modo local-only');
    return;
  }

  _mode = SYNC_REDIS_MODE_ENV === 'streams' ? 'redis-streams' : 'redis-pubsub';
  await _connectClients();
}

async function _connectClients(): Promise<void> {
  try {
    // ── Publisher ──────────────────────────────────────────────────────────
    pubClient = createClient({ url: REDIS_URL });
    pubClient.on('error', _onPubError);
    pubClient.on('reconnecting', () => Log.info('[SyncRedisBus] Publisher reconectando...'));
    await pubClient.connect();

    // ── Subscriber (PubSub mode ou PubSub para push imediato em Streams) ──
    subClient = createClient({ url: REDIS_URL });
    subClient.on('error', _onSubError);
    subClient.on('reconnecting', () => Log.info('[SyncRedisBus] Subscriber reconectando...'));
    await subClient.connect();

    // Subscrição de padrão para receber eventos de outras instâncias
    await subClient.pSubscribe(`${CHANNEL_PREFIX}:*`, _handleRedisMessage);

    _connected          = true;
    _setDegraded(false, 'CONNECTED');
    _reconnectAttempts  = 0;
    _lastErrorAt        = null;
    _lastErrorMessage   = null;

    Log.info(`[SyncRedisBus] Conectado | mode=${_mode} | instanceId=${INSTANCE_ID}`);
  } catch (err: any) {
    _recordError(err.message);
    _connected = false;
    _scheduleReconnect();
  }
}

// ─── Handlers de erro e reconexão ─────────────────────────────────────────────

function _onPubError(err: Error): void {
  _connected = false;
  _recordError(err.message);
  Log.warn(`[SyncRedisBus] Publisher error: ${_sanitize(err.message)}`);
}

function _onSubError(err: Error): void {
  _recordError(err.message);
  Log.warn(`[SyncRedisBus] Subscriber error: ${_sanitize(err.message)}`);
}

function _recordError(message: string): void {
  _lastErrorAt      = new Date().toISOString();
  _lastErrorMessage = _sanitize(message);
}

function _setDegraded(value: boolean, reason: string): void {
  if (_degraded === value) return;
  _degraded = value;
  recordDiagnostic('degradedTransitions', {
    type: value ? 'DEGRADED_ON' : 'DEGRADED_OFF',
    reason,
    message: _lastErrorMessage ?? undefined,
  });
}

/** Sanitiza mensagem de erro — remove URLs, tokens e senhas */
function _sanitize(message: string): string {
  return message
    .replace(/redis:\/\/[^@\s]*@/gi, 'redis://<redacted>@')
    .replace(/password=[^\s&]*/gi, 'password=<redacted>')
    .substring(0, 200);
}

function _scheduleReconnect(): void {
  if (_reconnectTimer || _degraded) return;

  _reconnectAttempts++;
  inc('reconnectAttemptsTotal');
  recordDiagnostic('reconnectEvents', {
    type: 'REDIS_RECONNECT_SCHEDULED',
    reason: 'CONNECTION_ERROR',
    message: _lastErrorMessage ?? undefined,
  });

  if (_reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    _setDegraded(true, 'MAX_RECONNECT_ATTEMPTS');
    Log.warn(`[SyncRedisBus] Máximo de tentativas (${MAX_RECONNECT_ATTEMPTS}) atingido → degraded`);
    return;
  }

  const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, _reconnectAttempts - 1), RECONNECT_MAX_MS);
  Log.info(`[SyncRedisBus] Reconectando em ${delay}ms (tentativa ${_reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  _reconnectTimer = setTimeout(async () => {
    _reconnectTimer = null;
    await _disconnectClients();
    await _connectClients();
  }, delay).unref();
}

async function _disconnectClients(): Promise<void> {
  try { if (subClient) await subClient.disconnect(); } catch {}
  try { if (pubClient) await pubClient.disconnect(); } catch {}
  subClient = null;
  pubClient = null;
}

// ─── Handler PubSub ───────────────────────────────────────────────────────────

async function _handleRedisMessage(message: string): Promise<void> {
  try {
    const envelope = JSON.parse(message) as RedisEventEnvelope;

    if (envelope._originInstanceId === INSTANCE_ID) return; // anti-eco

    // COMM-7: dedup com TTL — verifica expiração antes de rejeitar
    const now = Date.now();
    const seenAt = _remoteProcessed.get(envelope.id);
    if (seenAt !== undefined) {
      if (now - seenAt < DEDUP_TTL_MS) {
        inc('duplicateEventsIgnored'); // métrica COMM-7
        Log.info(`[SyncRedisBus] Duplicado remoto ignorado: id=${envelope.id}`);
        return;
      }
      // TTL expirou — permite reprocessar (raro, mas correto)
      _remoteProcessed.delete(envelope.id);
    }
    // Registra com timestamp; evicção incremental por tamanho
    _remoteProcessed.set(envelope.id, now);
    if (_remoteProcessed.size > MAX_REMOTE_SEEN) {
      // Remove entrada mais antiga (primeira inserção no Map)
      const oldest = _remoteProcessed.keys().next().value;
      if (oldest) _remoteProcessed.delete(oldest);
    }

    const { _originInstanceId: _, ...event } = envelope;
    Log.info(`[SyncRedisBus] Evento remoto: ${event.type} | empresa=${event.empresaId} correlationId=${event.correlationId}`);

    const registry = await getRegistryModule();
    registry.storeEventFromRemote(event as SyncEvent);

    const sse = await getSseModule();
    sse.pushEventToTenant(event.empresaId, event as SyncEvent);
  } catch (err: any) {
    Log.warn(`[SyncRedisBus] Erro no handler PubSub: ${_sanitize(err.message)}`);
  }
}

// ─── Publicação (PubSub + Streams) ───────────────────────────────────────────

/**
 * Publica evento no Redis.
 * - Sempre usa PubSub para entrega imediata SSE.
 * - Em modo streams: também adiciona ao Redis Stream para replay cross-instância.
 */
export async function publish(event: SyncEvent): Promise<void> {
  if (!_connected || !pubClient || _degraded) return;

  const envelope: RedisEventEnvelope = { ...event, _originInstanceId: INSTANCE_ID };
  const json = JSON.stringify(envelope);

  try {
    // PubSub — entrega imediata para SSE das outras instâncias
    const channel = `${CHANNEL_PREFIX}:${event.empresaId}`;
    await pubClient.publish(channel, json);
    Log.info(`[SyncRedisBus] PubSub publicado: ${event.type} -> ${channel} correlationId=${event.correlationId}`);

    // Streams — persistência para replay cross-instância
    if (_mode === 'redis-streams') {
      const streamKey = `${STREAM_PREFIX}:${event.empresaId}`;
      // COMM-6: captura stream ID retornado pelo XADD para uso no cursor canônico
      const streamId = await pubClient.xAdd(
        streamKey,
        '*', // ID automático (timestamp Redis)
        {
          id:         event.id,
          type:       event.type,
          entity:     event.entity,
          entityId:   event.entityId,
          empresaId:  event.empresaId,
          payload:    JSON.stringify(event.payload),
          occurredAt: event.occurredAt,
          correlationId: event.correlationId,
          version:    String(event.version),
          originInstanceId: INSTANCE_ID,
        },
        {
          TRIM: {
            strategy:  'MAXLEN',
            strategyModifier: '~',
            threshold: STREAM_MAXLEN,
          },
        }
      );
      _lastStreamIdByEmpresa.set(event.empresaId, streamId);
      Log.info(`[SyncRedisBus] Stream XADD: ${event.type} -> ${streamKey} id=${streamId} correlationId=${event.correlationId}`);
    }
  } catch (err: any) {
    _connected = false;
    _recordError(err.message);
    Log.warn(`[SyncRedisBus] Falha ao publicar: ${_sanitize(err.message)}`);
    _scheduleReconnect();
  }
}

// ─── Replay via Redis Streams ─────────────────────────────────────────────────

/**
 * Lê eventos de um Redis Stream desde um cursor.
 * Cursor em modo Streams = Redis stream ID (e.g. "1718000000000-0").
 * Cursor vazio = últimas 100 entradas.
 *
 * Retorna [] se Redis indisponível ou modo não-streams.
 */
export async function readStreamSince(
  empresaId: string,
  cursor: string
): Promise<SyncEvent[]> {
  if (!pubClient || !_connected || _degraded || _mode !== 'redis-streams') return [];

  try {
    const streamKey = `${STREAM_PREFIX}:${empresaId}`;
    const streamId  = cursor || '0-0'; // '0-0' = início do stream

    const results = await pubClient.xRead(
      [{ key: streamKey, id: streamId }],
      { COUNT: 200 }
    );

    if (!results || results.length === 0) return [];

    const events: SyncEvent[] = [];
    for (const result of results) {
      for (const entry of result.messages) {
        try {
          const f = entry.message;
          // Ignora entradas da própria instância (para evitar duplicação com buffer local)
          if (f['originInstanceId'] === INSTANCE_ID) continue;

          events.push({
            id:            f['id']!,
            type:          f['type'] as SyncEvent['type'],
            entity:        f['entity']!,
            entityId:      f['entityId']!,
            empresaId:     f['empresaId']!,
            payload:       JSON.parse(f['payload'] || '{}'),
            occurredAt:    f['occurredAt']!,
            correlationId: f['correlationId'] || randomUUID(),
            version:       parseInt(f['version'] || '1'),
          });
        } catch { /* entrada corrompida — ignora */ }
      }
    }
    return events;
  } catch (err: any) {
    Log.warn(`[SyncRedisBus] Erro ao ler stream: ${_sanitize(err.message)}`);
    return [];
  }
}

/**
 * Retorna o ID do último item do stream de uma empresa.
 * Usado como syncCursor quando mode=streams.
 */
export async function getLatestStreamId(empresaId: string): Promise<string | null> {
  if (!pubClient || !_connected || _degraded || _mode !== 'redis-streams') return null;
  try {
    const streamKey = `${STREAM_PREFIX}:${empresaId}`;
    const results = await pubClient.xRevRange(streamKey, '+', '-', { COUNT: 1 });
    return results.length > 0 ? results[0]!.id : null;
  } catch {
    return null;
  }
}

// ─── Getters de métricas ──────────────────────────────────────────────────────

export const isConnected             = (): boolean      => _connected;
export const isDegraded              = (): boolean      => _degraded;
export const getMode                 = (): TransportMode => _mode;
export const isEnabled               = (): boolean      => SYNC_REDIS_ENABLED;
export const getInstanceId           = (): string       => INSTANCE_ID;
export const getReconnectAttempts    = (): number       => _reconnectAttempts;
export const getLastErrorAt          = (): string|null  => _lastErrorAt;
export const getLastErrorMessage     = (): string|null  => _lastErrorMessage;

/**
 * COMM-6: retorna o último stream ID conhecido para uma empresa nesta instância.
 * Capturado no XADD — mais recente que getLatestStreamId() em uso normal.
 * Retorna null se nenhum evento foi publicado nesta instância para a empresa.
 */
export const getLastKnownStreamId = (empresaId: string): string | null =>
  _lastStreamIdByEmpresa.get(empresaId) ?? null;

// ─── Shutdown ─────────────────────────────────────────────────────────────────

export async function shutdown(): Promise<void> {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  await _disconnectClients();
  _connected = false;
  Log.info('[SyncRedisBus] Desconectado.');
}

/** Permite forçar reconexão manual após modo degraded */
export async function reconnect(): Promise<void> {
  _degraded           = false;
  _reconnectAttempts  = 0;
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  await _disconnectClients();
  await _connectClients();
}

// ─── Reset para testes ────────────────────────────────────────────────────────

export function _resetForTests(): void {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  pubClient           = null;
  subClient           = null;
  _connected          = false;
  _degraded           = false;
  _initialized        = false;
  _mode               = 'local-only';
  _reconnectAttempts  = 0;
  _lastErrorAt        = null;
  _lastErrorMessage   = null;
  _remoteProcessed.clear(); // COMM-7: Map<id,timestamp>
  _lastStreamIdByEmpresa.clear(); // COMM-6
  _sseModule          = null;
  _registryModule     = null;
}
