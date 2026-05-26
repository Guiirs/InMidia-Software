/**
 * Operational Sync Layer — Tipos canônicos
 *
 * Contratos compartilhados entre sync.service, sync.controller e testes.
 * Mantidos simples por design: a complexidade fica no service, não nos tipos.
 *
 * COMM-6: cursor canônico por modo de transporte.
 */

// ─── Nomes de eventos ─────────────────────────────────────────────────────────

export const SYNC_EVENT_TYPES = {
  // Placa
  PLACA_CREATED:         'PLACA_CREATED',
  PLACA_UPDATED:         'PLACA_UPDATED',
  PLACA_STATUS_CHANGED:  'PLACA_STATUS_CHANGED',
  PLACA_DELETED:         'PLACA_DELETED',
  // Região
  REGIAO_UPDATED:        'REGIAO_UPDATED',
  // Dashboard / sistema
  DASHBOARD_INVALIDATED: 'DASHBOARD_INVALIDATED',
  SYSTEM_STATUS_CHANGED: 'SYSTEM_STATUS_CHANGED',
} as const;

export type SyncEventType = typeof SYNC_EVENT_TYPES[keyof typeof SYNC_EVENT_TYPES];

// ─── Evento de sync ───────────────────────────────────────────────────────────

export interface SyncEvent {
  /** UUID do evento — para deduplicação no cliente */
  id: string;
  /** Tipo canônico do evento */
  type: SyncEventType;
  /** Nome da entidade afetada (e.g. 'placa', 'regiao') */
  entity: string;
  /** ID da entidade afetada */
  entityId: string;
  /** ID da empresa dona dos dados — usado para isolamento multi-tenant */
  empresaId: string;
  /** Payload mínimo suficiente para o cliente atualizar o estado local */
  payload: Record<string, unknown>;
  /** Timestamp ISO 8601 de quando o evento ocorreu */
  occurredAt: string;
  /** ID do usuário que causou o evento, quando disponível */
  actorId?: string;
  /** ID de correlação para rastreabilidade */
  correlationId: string;
  /** Versão do schema do evento — permite evolução sem breaking change */
  version: number;
}

// ─── Cursor de sincronização — COMM-6 ────────────────────────────────────────

/**
 * Cursor canônico por modo de transporte.
 * Substitui o cursor string puro (LegacyCursor).
 *
 * mode: 'local'   → value é ISO 8601 timestamp (buffer em memória)
 * mode: 'pubsub'  → value é ISO 8601 timestamp (pub/sub Redis, replay local)
 * mode: 'streams' → value é Redis stream ID (e.g. "1718000000000-0")
 */
export interface SyncCursor {
  mode: 'local' | 'pubsub' | 'streams';
  value: string;
  issuedAt: string; // ISO 8601 — quando o cursor foi emitido
}

/**
 * @deprecated Use SyncCursor object. Aceito temporariamente por compatibilidade retroativa.
 * - String ISO 8601 → tratada como cursor local/pubsub
 * - String Redis stream ID (padrão \d+-\d+) → tratada como cursor streams
 * - String base64url(JSON.stringify(SyncCursor)) → decodificada
 */
export type LegacyCursor = string;

/** Tipos aceitos nas entradas do backend ao ler um cursor de query string */
export type AnyCursor = SyncCursor | LegacyCursor;

// ─── Utilitários de cursor — COMM-6 ──────────────────────────────────────────

const _STREAM_ID_RE = /^\d+-\d+$/;

/** Retorna true se a string parece um Redis stream ID (e.g. "1718000000000-0"). */
export function isRedisStreamId(s: string): boolean {
  return _STREAM_ID_RE.test(s);
}

/**
 * Converte AnyCursor para SyncCursor canônico.
 * Retorna null se o cursor for inválido ou irreconhecível.
 *
 * Ordem de detecção:
 *   1. SyncCursor object        → retorna como está
 *   2. string base64url JSON    → decodifica
 *   3. string Redis stream ID   → mode: 'streams'
 *   4. string ISO timestamp     → mode: 'local'
 *   5. qualquer outra coisa     → null (cursor inválido)
 */
export function parseCursor(raw: AnyCursor | null | undefined): SyncCursor | null {
  if (raw == null) return null;

  // Já canônico
  if (typeof raw === 'object') {
    if ('mode' in raw && 'value' in raw && 'issuedAt' in raw) return raw as SyncCursor;
    return null;
  }

  if (typeof raw !== 'string' || raw === '') return null;

  // Tenta base64url → JSON
  try {
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'mode' in parsed &&
      'value' in parsed &&
      'issuedAt' in parsed
    ) {
      return parsed as SyncCursor;
    }
  } catch { /* não é base64 JSON */ }

  // Redis stream ID
  if (isRedisStreamId(raw)) {
    return { mode: 'streams', value: raw, issuedAt: new Date().toISOString() };
  }

  // ISO timestamp → local
  const ts = new Date(raw).getTime();
  if (!isNaN(ts)) {
    return { mode: 'local', value: raw, issuedAt: new Date().toISOString() };
  }

  return null; // cursor inválido
}

/**
 * Serializa SyncCursor para base64url JSON — seguro para uso em query string.
 * O backend aceita este formato no parâmetro `cursor`.
 */
export function serializeCursor(cursor: SyncCursor): string {
  const json = JSON.stringify(cursor);
  return Buffer.from(json)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Cria cursor canônico para modo local ou pubsub. */
export function makeLocalCursor(isoTimestamp?: string): SyncCursor {
  const value = isoTimestamp ?? new Date().toISOString();
  return { mode: 'local', value, issuedAt: new Date().toISOString() };
}

/** Cria cursor canônico para modo pubsub. */
export function makePubsubCursor(isoTimestamp?: string): SyncCursor {
  const value = isoTimestamp ?? new Date().toISOString();
  return { mode: 'pubsub', value, issuedAt: new Date().toISOString() };
}

/** Cria cursor canônico para modo streams. */
export function makeStreamsCursor(streamId: string): SyncCursor {
  return { mode: 'streams', value: streamId, issuedAt: new Date().toISOString() };
}

// ─── Observabilidade operacional — COMM-7 ────────────────────────────────────

/**
 * Razão pela qual o backend sinalizou needsSnapshot: true.
 * Permite que o frontend tome ações corretivas mais específicas.
 */
export type SnapshotRecoveryReason =
  | 'CURSOR_INVALID'       // cursor não reconhecível pelo parseCursor
  | 'STREAM_TRUNCATED'     // stream ID mais antigo que o disponível no Redis
  | 'REPLAY_UNAVAILABLE'   // Redis desconectado e buffer local insuficiente
  | 'RECONNECT_DELAYED';   // cliente ficou desconectado por muito tempo

/** Saúde agregada do subsistema de sync. */
export interface SyncHealthMetrics {
  /** true quando todos os subsistemas estão saudáveis */
  healthy: boolean;
  /** Razões de degradação — vazio quando healthy */
  degradedReasons: string[];
  /** true quando há tentativa de reconexão Redis em andamento */
  reconnecting: boolean;
  /** true quando replay cross-instância via Redis Streams está disponível */
  replayAvailable: boolean;
  /** Score operacional agregado, 0-100. */
  score: number;
  /** Status operacional derivado do score. */
  status: 'healthy' | 'warning' | 'degraded' | 'critical';
  /** Lag estimado em ms entre publicação e entrega SSE (streams mode apenas) */
  streamLagMs?: number;
  /** Latência média entre publicação e entrega SSE. */
  averageLagMs?: number;
  /** Última latência medida entre publicação e entrega SSE. */
  latestLagMs?: number;
  /** ISO 8601 do evento mais antigo no buffer local desta instância */
  oldestBufferedEventAt?: string;
  /** ISO 8601 do evento mais recente no buffer local desta instância */
  latestEventAt?: string;
}

/** Métricas de throughput acumuladas desde o último restart. */
export interface SyncThroughputMetrics {
  eventsPublishedTotal:   number;
  eventsDeliveredSSE:     number;
  eventsDeliveredPolling: number;
  replayRequests:         number;
  replayFailures:         number;
  snapshotRecoveries:     number;
  duplicateEventsIgnored: number;
  legacyCursorUses:       number;
  reconnectAttemptsTotal: number;
  /** Milliseconds desde o boot do subsistema de sync */
  uptimeMs:               number;
}

export interface SyncLagMetrics {
  latestLagMs:  number;
  averageLagMs: number;
  samples:      number;
}

export interface DiagnosticBufferEntry {
  at: string;
  empresaId?: string;
  type: string;
  source?: 'replayFailures' | 'reconnectEvents' | 'snapshotRecoveries' | 'degradedTransitions' | 'recentEvents';
  severity?: 'info' | 'warning' | 'critical';
  reason?: string;
  message?: string;
  correlationId?: string;
  instanceId?: string;
}

export interface SyncDiagnosticsQuery {
  empresaId?: string;
  type?: string;
  since?: string;
  until?: string;
  severity?: string;
  correlationId?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface SyncDiagnosticsTimelineResponse {
  items: DiagnosticBufferEntry[];
  page: {
    limit: number;
    offset: number;
    total: number;
    nextCursor: string | null;
  };
}

/** Resposta do endpoint admin GET /sync/diagnostics. */
export interface SyncDiagnosticsResponse {
  instanceId:          string;
  uptimeMs:            number;
  mode:                string;
  connected:           boolean;
  degraded:            boolean;
  degradedReason?:     string | null;
  transportHealth:     'healthy' | 'degraded' | 'disconnected';
  healthScore:         number;
  healthStatus:        SyncHealthMetrics['status'];
  redisConnected:      boolean;
  sseConnected:        boolean;
  averageLagMs:        number;
  latestLagMs:         number;
  replayFailureCount:  number;
  reconnectAttempts:   number;
  sseClientsConnected: number;
  streamModeActive:    boolean;
  bufferStats: {
    totalEvents:      number;
    tenantsWithBuffer: number;
    oldestEventAt:    string | null;
    latestEventAt:    string | null;
  };
  throughput: SyncThroughputMetrics;
  replayFailures: Array<DiagnosticBufferEntry>;
  reconnectEvents: Array<DiagnosticBufferEntry>;
  snapshotRecoveriesLog: Array<DiagnosticBufferEntry>;
  degradedTransitions: Array<DiagnosticBufferEntry>;
  recentEventsPage: {
    limit: number;
    offset: number;
    total: number;
    nextOffset: number | null;
  };
  /** Últimos 20 eventos emitidos (ids + tipos, sem payload) */
  recentEvents: Array<{
    id:         string;
    type:       string;
    empresaId:  string;
    occurredAt: string;
    correlationId: string;
  }>;
}

// ─── Status operacional ───────────────────────────────────────────────────────

export interface SyncModuleStatus {
  name: string;
  healthy: boolean;
  lastCheck?: string;
}

export interface SyncTransportMetrics {
  /** Modo de transporte ativo — COMM-5 adiciona redis-streams */
  mode: 'local-only' | 'redis-pubsub' | 'redis-streams';
  /** true quando Redis está configurado mas operando em modo degradado */
  degraded: boolean;
  /** Redis habilitado por configuração (SYNC_REDIS_ENABLED) */
  redisEnabled: boolean;
  /** Redis está conectado e respondendo */
  redisConnected: boolean;
  /** Número de tentativas de reconexão desde o último sucesso */
  redisReconnectAttempts: number;
  /** ISO 8601 do último erro Redis, ou null se sem erros */
  lastRedisErrorAt: string | null;
  /** Mensagem sanitizada do último erro Redis */
  lastRedisErrorMessage: string | null;
  /** Número de clientes SSE conectados NESTA instância */
  sseClientsConnected: number;
  /** Total de eventos no buffer em memória (todas as empresas) */
  eventBufferSize: number;
  /** ID único desta instância do processo */
  instanceId: string;
}

export interface SyncStatus {
  /** Versão da API (package.json version) */
  apiVersion: string;
  /** Versão do contrato de sync — incrementar ao mudar shape de eventos */
  contractVersion: number;
  /** Tempo do servidor em ISO 8601 */
  serverTime: string;
  /** Módulos principais e saúde */
  modules: SyncModuleStatus[];
  /** Status do banco de dados */
  databaseStatus: 'connected' | 'disconnected' | 'degraded';
  /** Status do cache Redis (opcional) */
  cacheStatus?: 'connected' | 'disconnected' | 'disabled';
  /** Em manutenção planejada — somente true se explicitamente configurado */
  maintenance: boolean;
  /** Feature flags relevantes para o frontend */
  featureFlags: Record<string, boolean>;
  /** Métricas de transporte — COMM-4 */
  transport: SyncTransportMetrics;
  /** Saúde agregada do subsistema de sync — COMM-7 */
  syncHealth: SyncHealthMetrics;
  /** Throughput acumulado desde o boot — COMM-7 */
  throughput: SyncThroughputMetrics;
}

// ─── Snapshot inicial ─────────────────────────────────────────────────────────

export interface SyncSnapshot {
  /** Resumo de placas da empresa */
  placas: {
    total: number;
    disponiveis: number;
    updatedAt: string;
  };
  /** Resumo de regiões */
  regioes: {
    total: number;
    updatedAt: string;
  };
  /** Dashboard summary inline */
  dashboard: {
    totalPlacas: number;
    placasDisponiveis: number;
    regiaoPrincipal: string;
  };
  /** Quando o snapshot foi gerado */
  snapshotAt: string;
  /**
   * Cursor canônico — COMM-6.
   * Use para buscar eventos ocorridos APÓS este snapshot via GET /sync/events?cursor=<base64>
   *
   * @deprecated legacyCursor (string ISO) ainda presente como fallback temporário.
   */
  syncCursor: SyncCursor;
  /**
   * Cursor legado (string ISO) — compatibilidade com clientes antigos.
   * @deprecated Será removido em versão futura. Use syncCursor.
   */
  legacyCursor: string;
}

// ─── Resposta de eventos ──────────────────────────────────────────────────────

export interface SyncEventsResponse {
  events: SyncEvent[];
  /** Cursor canônico para a próxima requisição — COMM-6 */
  nextCursor: SyncCursor;
  /** Quantos eventos foram retornados */
  count: number;
  /**
   * true quando o cursor fornecido era inválido ou expirado demais.
   * O cliente deve chamar fetchSyncSnapshot() e re-sincronizar.
   */
  needsSnapshot?: boolean;
  /**
   * Razão detalhada quando needsSnapshot=true — COMM-7.
   * Permite que o cliente tome ações corretivas mais específicas.
   */
  needsSnapshotReason?: SnapshotRecoveryReason;
}
