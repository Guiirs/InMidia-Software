/**
 * Contratos canônicos do frontend.
 *
 * REGRA: nenhum componente deve normalizar dados da API diretamente.
 * Toda transformação vive nos adapters (src/adapters/).
 * Os contratos aqui são a fonte de verdade para os tipos e validações.
 *
 * Campos canônicos definidos:
 *   - disponivel  (não `ativa`)
 *   - regiaoId    (não `regiao_id`)
 *   - id          (sempre presente junto com `_id`)
 */

// ---------------------------------------------------------------------------
// Contrato: Placa
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PlacaCanonica
 * @property {string}  id               - ID canônico (string)
 * @property {string}  _id              - Alias legado do MongoDB
 * @property {string}  numero_placa
 * @property {number}  [numeroOperacional]
 * @property {boolean} disponivel       - Campo canônico. Indica se fisicamente operacional.
 * @property {boolean} ativa            - Alias mantido para compat. Mesmo valor que disponivel.
 * @property {string}  [nomeDaRua]
 * @property {string}  [localizacao]
 * @property {Object}  regiao           - Objeto { _id, id, nome }
 * @property {string}  regiao_nome
 * @property {string}  [tipo]
 * @property {number}  [valor_mensal]
 * @property {string}  [imagem]
 * @property {boolean} [aluguel_ativo]
 * @property {boolean} [aluguel_futuro]
 * @property {'disponivel'|'alugada'|'reservada'} [statusAluguel]
 * @property {string}  [cliente_nome]
 * @property {string}  [aluguel_data_inicio]
 * @property {string}  [aluguel_data_fim]
 */

/**
 * @typedef {Object} PaginacaoCanonica
 * @property {number} totalDocs
 * @property {number} totalPages
 * @property {number} currentPage
 * @property {number} limit
 * @property {boolean} hasNextPage
 * @property {boolean} hasPrevPage
 */

/**
 * @typedef {Object} PlacasListResponse
 * @property {PlacaCanonica[]} data
 * @property {PaginacaoCanonica} pagination
 */

// ---------------------------------------------------------------------------
// Contrato: Região
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RegiaoCanonica
 * @property {string}  id       - ID canônico
 * @property {string}  _id      - Alias legado
 * @property {string}  nome
 * @property {string}  [codigo]
 * @property {boolean} [ativo]
 */

// ---------------------------------------------------------------------------
// Contrato: Dashboard Summary
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DashboardSummaryCanonical
 * @property {number} totalPlacas
 * @property {number} placasDisponiveis
 * @property {string} regiaoPrincipal
 */

// ---------------------------------------------------------------------------
// Contrato: Placas por Região (para gráfico)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PlacasPorRegiaoItem
 * @property {string} regiao      - Nome da região
 * @property {number} total       - Total de placas (campo canônico)
 * @property {number} total_placas - Alias legado retornado pelo backend
 */

// ---------------------------------------------------------------------------
// Contrato: Resposta padrão da API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {*}       [data]
 * @property {string}  [error]
 * @property {Object}  [meta]
 */

/**
 * @typedef {Object} ApiErrorResponse
 * @property {boolean} success   - false
 * @property {string}  error     - Mensagem de erro
 * @property {string}  [code]    - Código de erro do domínio
 * @property {Array}   [errors]  - Erros de validação { field, message }
 */

// ---------------------------------------------------------------------------
// Validadores de contrato (runtime guards)
// ---------------------------------------------------------------------------

/**
 * Verifica se um objeto é uma PlacaCanonica válida.
 * Usado nos testes de contrato e em desenvolvimento.
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isPlacaCanonica(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const p = /** @type {any} */ (obj);
  return (
    typeof (p.id ?? p._id) === 'string' &&
    typeof p.numero_placa === 'string' &&
    typeof p.disponivel === 'boolean'
  );
}

/**
 * Verifica se um objeto é uma DashboardSummaryCanonical válida.
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isDashboardSummary(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const d = /** @type {any} */ (obj);
  return (
    typeof d.totalPlacas === 'number' &&
    typeof d.placasDisponiveis === 'number' &&
    typeof d.regiaoPrincipal === 'string'
  );
}

/**
 * Verifica se um objeto é uma RegiaoCanonica válida.
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isRegiaoCanonica(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const r = /** @type {any} */ (obj);
  return typeof (r.id ?? r._id) === 'string' && typeof r.nome === 'string';
}

/**
 * Verifica se a resposta paginada de placas é válida.
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isPlacasListResponse(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const r = /** @type {any} */ (obj);
  return Array.isArray(r.data) && r.pagination && typeof r.pagination.totalDocs === 'number';
}

/**
 * Verifica o campo canônico de disponibilidade em uma placa.
 * Retorna true se o campo `disponivel` existe e é boolean.
 * @param {unknown} placa
 * @returns {boolean}
 */
export function hasDisponivel(placa) {
  return placa !== null && typeof placa === 'object' && typeof (/** @type {any} */ (placa)).disponivel === 'boolean';
}

/**
 * Campos conhecidos que devem estar presentes em cada item de placa listada.
 */
export const PLACA_REQUIRED_FIELDS = ['numero_placa', 'disponivel'];

/**
 * Campos conhecidos que devem estar presentes no dashboard summary.
 */
export const DASHBOARD_REQUIRED_FIELDS = ['totalPlacas', 'placasDisponiveis', 'regiaoPrincipal'];

/**
 * Limite máximo que o frontend pode requisitar sem quebrar o backend.
 * Mapeado de: BECKEND/src/modules/placas/dtos/placa.dto.ts -> ListPlacasQuerySchema -> max(1000)
 */
export const PLACA_MAX_LIMIT = 1000;

/**
 * Limite máximo para regiões (ARCH-2: aumentado de 100 para 500).
 * Mapeado de: BECKEND/src/modules/regioes/dtos/regiao.dto.ts -> ListRegioesQuerySchema -> max(500)
 */
export const REGIAO_MAX_LIMIT = 500;

// ---------------------------------------------------------------------------
// Contrato: Operational Sync Layer (COMM-1)
// ---------------------------------------------------------------------------

/**
 * Tipos de evento de sync — espelham SYNC_EVENT_TYPES do backend.
 * Mantidos em sync manual: se o backend adicionar um tipo, adicionar aqui.
 */
export const SYNC_EVENT_TYPES = /** @type {const} */ ({
  PLACA_CREATED:         'PLACA_CREATED',
  PLACA_UPDATED:         'PLACA_UPDATED',
  PLACA_STATUS_CHANGED:  'PLACA_STATUS_CHANGED',
  PLACA_DELETED:         'PLACA_DELETED',
  REGIAO_UPDATED:        'REGIAO_UPDATED',
  DASHBOARD_INVALIDATED: 'DASHBOARD_INVALIDATED',
  SYSTEM_STATUS_CHANGED: 'SYSTEM_STATUS_CHANGED',
});

/**
 * @typedef {Object} SyncEvent
 * @property {string}  id             - UUID do evento
 * @property {string}  type           - Tipo canônico (ver SYNC_EVENT_TYPES)
 * @property {string}  entity         - Nome da entidade ('placa', 'regiao', ...)
 * @property {string}  entityId       - ID da entidade afetada
 * @property {string}  empresaId      - Empresa dona dos dados
 * @property {Object}  payload        - Payload mínimo para atualização local
 * @property {string}  occurredAt     - ISO 8601
 * @property {string}  [actorId]      - ID do usuário que causou o evento
 * @property {number}  version        - Versão do schema do evento
 */

/**
 * @typedef {Object} SyncStatus
 * @property {string}   apiVersion       - Versão da API
 * @property {number}   contractVersion  - Versão do contrato de sync
 * @property {string}   serverTime       - ISO 8601
 * @property {Array}    modules          - Lista de módulos com saúde
 * @property {string}   databaseStatus   - 'connected' | 'disconnected' | 'degraded'
 * @property {string}   [cacheStatus]    - 'connected' | 'disconnected' | 'disabled'
 * @property {boolean}  maintenance      - true apenas se MAINTENANCE_MODE=true no servidor
 * @property {Object}   featureFlags     - Flags para o frontend
 */

/**
 * @typedef {{ mode: 'local'|'pubsub'|'streams', value: string, issuedAt: string }} SyncCursor
 * Cursor canônico — COMM-6. Substitui o cursor string puro (LegacyCursor).
 */

/**
 * @typedef {Object} SyncSnapshot
 * @property {{ total: number, disponiveis: number, updatedAt: string }} placas
 * @property {{ total: number, updatedAt: string }} regioes
 * @property {{ totalPlacas: number, placasDisponiveis: number, regiaoPrincipal: string }} dashboard
 * @property {string}     snapshotAt   - ISO 8601 de quando o snapshot foi gerado
 * @property {SyncCursor} syncCursor   - Cursor canônico (COMM-6)
 * @property {string}     legacyCursor - Cursor legado ISO 8601 (@deprecated, compat temporária)
 */

/**
 * @typedef {Object} SyncEventsResponse
 * @property {SyncEvent[]} events       - Lista de eventos
 * @property {SyncCursor}  nextCursor   - Cursor canônico para a próxima requisição (COMM-6)
 * @property {number}      count        - Quantidade de eventos
 * @property {boolean}     [needsSnapshot] - true se cursor expirado; cliente deve refazer snapshot
 */

// Versão do contrato de sync — deve bater com CONTRACT_VERSION do backend
// COMM-6: incrementado para 2 (cursor canônico por modo de transporte)
export const SYNC_CONTRACT_VERSION = 2;

// Intervalo de polling em ms
export const SYNC_POLL_INTERVAL_MS = typeof window !== 'undefined' && window.location?.hostname === 'localhost'
  ? 5_000
  : 15_000;

/**
 * Valida se um objeto é um SyncEvent válido.
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isSyncEvent(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const e = /** @type {any} */ (obj);
  return (
    typeof e.id === 'string' &&
    typeof e.type === 'string' &&
    typeof e.entityId === 'string' &&
    typeof e.occurredAt === 'string'
  );
}

/**
 * Valida se o status retornado pelo /sync/status tem shape correto.
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isSyncStatus(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const s = /** @type {any} */ (obj);
  return (
    typeof s.apiVersion === 'string' &&
    typeof s.contractVersion === 'number' &&
    typeof s.serverTime === 'string' &&
    typeof s.maintenance === 'boolean'
  );
}

/**
 * Valida se o snapshot retornado pelo /sync/snapshot tem shape correto.
 * COMM-6: aceita syncCursor como objeto canônico OU string legada.
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isSyncSnapshot(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const s = /** @type {any} */ (obj);
  const hasCursor =
    (typeof s.syncCursor === 'object' && s.syncCursor !== null && typeof s.syncCursor.value === 'string') ||
    (typeof s.syncCursor === 'string' && s.syncCursor.length > 0) || // compat legado
    (typeof s.legacyCursor === 'string' && s.legacyCursor.length > 0); // fallback compat
  return (
    s.placas && typeof s.placas.total === 'number' &&
    s.dashboard && typeof s.dashboard.totalPlacas === 'number' &&
    hasCursor
  );
}

/**
 * Serializa um SyncCursor object para base64url JSON (para envio em query string).
 * Compatível com o parseCursor do backend.
 * @param {SyncCursor|string|null} cursor
 * @returns {string|null}
 */
export function serializeCursor(cursor) {
  if (!cursor) return null;
  if (typeof cursor === 'string') return cursor; // legacy — envia como-está
  try {
    const json = JSON.stringify(cursor);
    // btoa → base64 → base64url (substituições compatíveis com backend)
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch {
    return null;
  }
}

/**
 * Tenta extraer um SyncCursor canônico de qualquer valor de cursor recebido.
 * Aceita objeto canônico ou string legada ISO.
 * @param {unknown} raw
 * @returns {SyncCursor|null}
 */
export function parseCursorFrontend(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null) {
    const c = /** @type {any} */ (raw);
    if (typeof c.mode === 'string' && typeof c.value === 'string') return c;
  }
  if (typeof raw === 'string' && raw.length > 0) {
    // Tenta base64 → JSON
    try {
      const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
      const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed.mode === 'string' && typeof parsed.value === 'string') return parsed;
    } catch { /* não é base64 JSON */ }
    // Stream ID
    if (/^\d+-\d+$/.test(raw)) return { mode: 'streams', value: raw, issuedAt: new Date().toISOString() };
    // ISO timestamp
    if (!isNaN(new Date(raw).getTime())) return { mode: 'local', value: raw, issuedAt: new Date().toISOString() };
  }
  return null;
}
