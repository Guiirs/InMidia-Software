/**
 * useSyncDiagnostics — COMM-7
 *
 * Hook de observabilidade do Operational Sync Layer.
 * Expõe estado interno do syncService para dashboards e debugging.
 *
 * Atualiza automaticamente a cada `refreshMs` ms (padrão: 5 segundos).
 * Não inicia nem controla o sync — apenas lê.
 *
 * Uso:
 *   const diag = useSyncDiagnostics();
 *   // diag.connected, diag.transportMode, diag.replayCount, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import * as syncService from '../services/syncService';

const DEFAULT_REFRESH_MS = 5_000;

/**
 * @typedef {Object} SyncDiagnosticsState
 * @property {boolean}      connected              - true se o transporte está ativo
 * @property {string}       transportMode          - modo de transporte atual (local-only, redis-pubsub, redis-streams)
 * @property {boolean}      degraded               - true se Redis está em modo degradado
 * @property {string}       transportHealth        - healthy, degraded ou disconnected
 * @property {string|null}  degradedReason         - razão operacional da degradação
 * @property {boolean}      redisConnected         - true se Redis está conectado
 * @property {boolean}      sseConnected           - true se SSE está conectado
 * @property {number}       averageLagMs           - latência média publish→delivery
 * @property {number}       latestLagMs            - última latência publish→delivery
 * @property {number}       replayFailureCount     - falhas/recoveries de replay percebidas
 * @property {number}       degradedTransitions    - transições de degradação observadas
 * @property {boolean}      legacyCursorDetected   - true se fallback de cursor legado foi usado
 * @property {number}       reconnectAttempts      - tentativas de reconexão SSE desde o boot
 * @property {string|null}  lastSyncAt             - ISO 8601 da última sincronização bem-sucedida
 * @property {string|null}  lastEventAt            - ISO 8601 do último evento despachado
 * @property {number}       replayCount            - número de replays (polls com eventos + reconexões SSE)
 * @property {number}       snapshotRecoveries     - número de snapshot recoveries executados
 * @property {number}       duplicateEventsIgnored - eventos ignorados por deduplicação
 * @property {boolean}      fallbackMode           - true quando polling substitui SSE
 * @property {number}       uptimeMs               - ms desde o boot do service
 */

/**
 * @param {{ refreshMs?: number }} [options]
 * @returns {SyncDiagnosticsState}
 */
export function useSyncDiagnostics({ refreshMs = DEFAULT_REFRESH_MS } = {}) {
  const [state, setState] = useState(() => syncService.getDiagnostics());

  const refresh = useCallback(() => {
    setState(syncService.getDiagnostics());
  }, []);

  useEffect(() => {
    // Atualiza imediatamente e depois em intervalo
    refresh();
    const id = setInterval(refresh, refreshMs);
    return () => clearInterval(id);
  }, [refresh, refreshMs]);

  return state;
}

export default useSyncDiagnostics;
