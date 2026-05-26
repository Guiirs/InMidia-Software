/**
 * useOperationalSync
 *
 * Hook que encapsula o ciclo de vida do syncService para componentes React.
 * Fornece:
 *   - status do sistema
 *   - snapshot inicial
 *   - função para subscrever eventos
 *   - função para forçar poll
 *   - flag de loading/erro
 *
 * Uso:
 *   const { snapshot, isReady, subscribeToEvent } = useOperationalSync();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as syncService from '../services/syncService';

/**
 * @param {{ autoStart?: boolean }} [options]
 */
export function useOperationalSync({ autoStart = true } = {}) {
  const [snapshot, setSnapshot]     = useState(syncService.getSnapshot());
  const [status, setStatus]         = useState(syncService.getStatus());
  const [isReady, setIsReady]       = useState(syncService.isBooted());
  const [error, setError]           = useState(null);
  const mountedRef                  = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!autoStart) return;

    (async () => {
      try {
        const result = await syncService.boot();
        if (!mountedRef.current) return;
        setSnapshot(result.snapshot);
        setStatus(result.status);
        setIsReady(true);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err.message ?? 'Sync indisponível');
        setIsReady(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      // Não para o polling — outros componentes podem estar usando
    };
  }, [autoStart]);

  /**
   * Subscreve a um tipo de evento de sync.
   * Retorna função de cleanup chamada automaticamente no unmount.
   *
   * @param {string} eventType - Tipo do evento ou '*' para todos
   * @param {(event: import('../contracts').SyncEvent) => void} handler
   */
  const subscribeToEvent = useCallback((eventType, handler) => {
    return syncService.subscribe(eventType, handler);
  }, []);

  /**
   * Força um poll imediato — útil após uma mutação para obter o evento de resposta.
   */
  const pollNow = useCallback(() => {
    return syncService.pollNow();
  }, []);

  return {
    snapshot,
    status,
    isReady,
    error,
    subscribeToEvent,
    pollNow,
  };
}

export default useOperationalSync;
