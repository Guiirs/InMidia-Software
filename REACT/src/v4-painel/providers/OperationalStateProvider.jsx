import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSyncCore } from '../../core/sync-core/SyncCoreProvider.jsx';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';
import { OPERATIONAL_STATE, getStateMeta } from '../foundation/operationalStates.js';
import { useRealtime } from './RealtimeProvider.jsx';

const READINESS_POLL_MS = 60_000;
const STALE_AFTER_MS = 2 * 60_000;

const OperationalStateContext = createContext(null);

function readinessToModules(readiness) {
  if (!readiness || typeof readiness !== 'object' || Array.isArray(readiness)) return [];
  return Object.entries(readiness)
    .filter(([key, value]) => key !== 'checkedAt' && value && typeof value === 'object')
    .map(([key, value]) => ({
      id: key,
      label: value.label ?? key,
      status: value.status ?? (value.ok === false ? OPERATIONAL_STATE.DEGRADED : OPERATIONAL_STATE.HEALTHY),
      latencyMs: value.latencyMs ?? null,
      message: value.message ?? null,
    }));
}

function resolveGlobalState({ readinessStatus, readinessError, lastSyncAt, realtimeStatus }) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return OPERATIONAL_STATE.OFFLINE;
  if (realtimeStatus === 'offline' || realtimeStatus === 'auth-expired') return OPERATIONAL_STATE.OFFLINE;
  if (readinessStatus === 'loading' || readinessStatus === 'refreshing') return OPERATIONAL_STATE.SYNCING;
  if (readinessError) return OPERATIONAL_STATE.DEGRADED;
  if (realtimeStatus === 'reconnecting' || realtimeStatus === 'stale' || realtimeStatus === 'backoff-paused') {
    return OPERATIONAL_STATE.DEGRADED;
  }
  if (lastSyncAt && Date.now() - lastSyncAt > STALE_AFTER_MS) return OPERATIONAL_STATE.DEGRADED;
  return OPERATIONAL_STATE.HEALTHY;
}

function formatLastSync(lastSyncAt) {
  if (!lastSyncAt) return 'Aguardando sync';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000));
  if (diffSeconds < 10) return 'Agora';
  if (diffSeconds < 60) return `Ha ${diffSeconds}s`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Ha ${diffMinutes}min`;
  return new Date(lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function normalizeAlerts(payload) {
  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : Array.isArray(payload) ? payload : [];
  return alerts.map((alert) => ({
    ...alert,
    read: Boolean(alert.read ?? alert.lida),
  }));
}

export function OperationalStateProvider({ children }) {
  const realtime = useRealtime();
  const syncCore = useSyncCore();
  const readinessResource = useSyncResource('system.readiness');
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      void readinessResource.refresh({ reason: 'readiness-poll' });
    }, READINESS_POLL_MS);
    return () => clearInterval(interval);
  }, [readinessResource]);

  useEffect(() => syncCore.store.subscribe('alerts.unread', (entry) => {
    setAlerts(normalizeAlerts(entry.data));
  }), [syncCore.store]);

  const lastSyncAt = readinessResource.lastSuccessAt ?? readinessResource.lastFetchedAt ?? null;
  const globalState = resolveGlobalState({
    readinessStatus: readinessResource.status,
    readinessError: readinessResource.error,
    lastSyncAt,
    realtimeStatus: realtime.status,
  });

  const stateMeta = getStateMeta(globalState);
  const modules = useMemo(() => readinessToModules(readinessResource.data), [readinessResource.data]);
  const unreadCount = alerts.filter((alert) => !alert.read).length;

  const markAlertRead = useCallback((alertId) => {
    setAlerts((prev) => prev.map((alert) => (
      alert.id === alertId ? { ...alert, read: true } : alert
    )));
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => prev.map((alert) => ({ ...alert, read: true })));
  }, []);

  const value = useMemo(() => ({
    globalState,
    stateMeta,
    modules,
    alerts,
    unreadCount,
    lastSyncLabel: formatLastSync(lastSyncAt),
    readiness: readinessResource.data ?? {},
    readinessStatus: readinessResource.status,
    readinessError: readinessResource.error,
    realtime,
    markAlertRead,
    markAllRead,
    refreshReadiness: readinessResource.refresh,
    STATES: OPERATIONAL_STATE,
  }), [
    alerts,
    globalState,
    lastSyncAt,
    markAlertRead,
    markAllRead,
    modules,
    readinessResource.data,
    readinessResource.error,
    readinessResource.refresh,
    readinessResource.status,
    realtime,
    stateMeta,
    unreadCount,
  ]);

  return (
    <OperationalStateContext.Provider value={value}>
      {children}
    </OperationalStateContext.Provider>
  );
}

export function useOperationalState() {
  const ctx = useContext(OperationalStateContext);
  if (!ctx) throw new Error('useOperationalState deve ser usado dentro de OperationalStateProvider');
  return ctx;
}
