import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { emitSyncEvent, syncEvents } from '../../core/sync-core/syncEvents.js';
import { getRealtimeStreamToken, getRealtimeV4Base } from '../../core/sync-core/realtime/realtimeTransport.js';

const HEARTBEAT_TIMEOUT_MS = 45_000;
const STALE_CONNECTION_MS = 2 * 60_000;
const MAX_RECENT_EVENTS = 30;
const MAX_SEEN_EVENT_IDS = 400;
const LS_REALTIME_FLAG_KEY = 'v4_realtime_enabled';
const MAX_RECONNECT_ATTEMPTS = 12;
const RECONNECT_WINDOW_MS = 5 * 60_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

const RealtimeContext = createContext(null);

function parseEventData(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function shouldIgnoreEvent(event) {
  return !event || !event.type || !event.timestamp;
}

function resolveRealtimeEnabled() {
  try {
    const stored = localStorage.getItem(LS_REALTIME_FLAG_KEY);
    if (stored !== null) return stored === 'true';
  } catch {
    /* preview contexts may not expose localStorage */
  }
  if (import.meta.env.V4_REALTIME_ENABLED === 'false' || import.meta.env.VITE_V4_REALTIME_ENABLED === 'false') {
    return false;
  }
  return true;
}

export function isRealtimeAuthExpiredError(error) {
  const statusCode = error?.statusCode || error?.response?.status;
  const code = String(error?.response?.data?.code || '').toUpperCase();
  return statusCode === 401 || code === 'TOKEN_EXPIRED';
}

function RealtimeProvider({ children }) {
  const { isAuthenticated, sessionExpired } = useAuth();
  const sourceRef = useRef(null);
  const heartbeatRef = useRef(null);
  const staleRef = useRef(null);
  const reconnectRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectWindowStartedAtRef = useRef(0);
  const connectedRef = useRef(false);
  const connectingRef = useRef(false);
  const realtimeEnabledRef = useRef(resolveRealtimeEnabled());
  const seenEventIdsRef = useRef(new Set());
  const listenersRef = useRef(new Map());
  const reconnectCountRef = useRef(0);
  const authFailuresRef = useRef(0);
  const staleConnectionsRef = useRef(0);
  const throughputRef = useRef([]);
  const authExpiredRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [eventCount, setEventCount] = useState(0);
  const [status, setStatus] = useState('idle');
  const [recentEvents, setRecentEvents] = useState([]);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [authFailures, setAuthFailures] = useState(0);
  const [staleConnections, setStaleConnections] = useState(0);
  const [throughputPerMinute, setThroughputPerMinute] = useState(0);
  const [lastConnectedAt, setLastConnectedAt] = useState(null);
  const [lastDisconnectedAt, setLastDisconnectedAt] = useState(null);

  const clearHeartbeatTimer = useCallback(() => {
    if (heartbeatRef.current) {
      clearTimeout(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const clearStaleTimer = useCallback(() => {
    if (staleRef.current) {
      clearTimeout(staleRef.current);
      staleRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const stopRealtime = useCallback((nextStatus = 'disabled') => {
    connectingRef.current = false;
    clearHeartbeatTimer();
    clearStaleTimer();
    clearReconnectTimer();
    sourceRef.current?.close?.();
    sourceRef.current = null;
    setConnected(false);
    setStatus(nextStatus);
    setLastDisconnectedAt(new Date().toISOString());
  }, [clearHeartbeatTimer, clearReconnectTimer, clearStaleTimer]);

  const markAuthExpired = useCallback(() => {
    authExpiredRef.current = true;
    authFailuresRef.current += 1;
    setAuthFailures(authFailuresRef.current);
    stopRealtime('auth-expired');
  }, [stopRealtime]);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    authExpiredRef.current = Boolean(sessionExpired);
    if (sessionExpired || !isAuthenticated || !localStorage.getItem('token')) {
      stopRealtime(sessionExpired ? 'auth-expired' : 'disabled');
    }
  }, [isAuthenticated, sessionExpired, stopRealtime]);

  useEffect(() => {
    const onAuthExpired = () => markAuthExpired();
    window.addEventListener('auth:expired', onAuthExpired);
    window.addEventListener('v4:session-expired', onAuthExpired);
    return () => {
      window.removeEventListener('auth:expired', onAuthExpired);
      window.removeEventListener('v4:session-expired', onAuthExpired);
    };
  }, [markAuthExpired]);

  const dispatchToSubscribers = useCallback((event) => {
    const byType = listenersRef.current.get(event.type);
    const wildcard = listenersRef.current.get('*');

    if (byType) {
      byType.forEach((handler) => handler(event));
    }
    if (wildcard) {
      wildcard.forEach((handler) => handler(event));
    }
  }, []);

  const trackThroughput = useCallback(() => {
    const now = Date.now();
    const cutoff = now - 60_000;
    throughputRef.current = throughputRef.current.filter((stamp) => stamp >= cutoff);
    throughputRef.current.push(now);
    setThroughputPerMinute(throughputRef.current.length);
  }, []);

  const scheduleHeartbeatTimeout = useCallback(() => {
    clearHeartbeatTimer();
    heartbeatRef.current = setTimeout(() => {
      setConnected(false);
      setStatus('stale');
      sourceRef.current?.close?.();
    }, HEARTBEAT_TIMEOUT_MS);
  }, [clearHeartbeatTimer]);

  const scheduleStaleConnectionTimeout = useCallback(() => {
    clearStaleTimer();
    staleRef.current = setTimeout(() => {
      staleConnectionsRef.current += 1;
      setStaleConnections(staleConnectionsRef.current);
      setConnected(false);
      setStatus('stale');
      sourceRef.current?.close?.();
    }, STALE_CONNECTION_MS);
  }, [clearStaleTimer]);

  const scheduleReconnect = useCallback((connectFn) => {
    if (authExpiredRef.current || !localStorage.getItem('token')) return;

    const now = Date.now();
    if (reconnectWindowStartedAtRef.current === 0 || now - reconnectWindowStartedAtRef.current > RECONNECT_WINDOW_MS) {
      reconnectWindowStartedAtRef.current = now;
      reconnectAttemptRef.current = 0;
    }

    reconnectAttemptRef.current += 1;
    reconnectCountRef.current += 1;
    setReconnectCount(reconnectCountRef.current);
    emitSyncEvent('sync:realtime-reconnect', {
      attempt: reconnectAttemptRef.current,
      reconnectCount: reconnectCountRef.current,
    });

    if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
      setStatus('backoff-paused');
      reconnectRef.current = setTimeout(() => {
        reconnectAttemptRef.current = 0;
        reconnectWindowStartedAtRef.current = Date.now();
        if (!authExpiredRef.current && localStorage.getItem('token')) void connectFn();
      }, RECONNECT_MAX_DELAY_MS);
      return;
    }

    const base = Math.min(RECONNECT_MAX_DELAY_MS, 800 * (2 ** (reconnectAttemptRef.current - 1)));
    const jitter = Math.floor(Math.random() * 500);
    const delayMs = base + jitter;
    reconnectRef.current = setTimeout(() => {
      if (!authExpiredRef.current && localStorage.getItem('token')) void connectFn();
    }, delayMs);
  }, []);

  const connect = useCallback(async () => {
    if (authExpiredRef.current || sessionExpired || !isAuthenticated) {
      stopRealtime(sessionExpired ? 'auth-expired' : 'disabled');
      return;
    }

    if (!realtimeEnabledRef.current) {
      setStatus('disabled');
      setConnected(false);
      return;
    }

    /* Impede chamadas concorrentes: se jÃ¡ estÃ¡ no meio de um connect async, ignora. */
    if (connectingRef.current) return;

    clearReconnectTimer();
    clearHeartbeatTimer();
    clearStaleTimer();

    if (sourceRef.current && sourceRef.current.readyState !== EventSource.CLOSED) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setStatus('disabled');
      setConnected(false);
      return;
    }

    connectingRef.current = true;
    let streamToken = null;
    try {
      streamToken = await getRealtimeStreamToken();
    } catch (error) {
      if (isRealtimeAuthExpiredError(error)) {
        markAuthExpired();
        return;
      }
      stopRealtime('reconnecting');
      scheduleReconnect(connect);
      return;
    }

    if (!streamToken) {
      markAuthExpired();
      return;
    }
    sourceRef.current?.close?.();

    const streamUrl = `${getRealtimeV4Base()}/realtime/stream?token=${encodeURIComponent(streamToken)}`;
    const es = new EventSource(streamUrl);
    sourceRef.current = es;
    connectingRef.current = false;

    setStatus('connecting');

    es.addEventListener('connected', () => {
      reconnectAttemptRef.current = 0;
      reconnectWindowStartedAtRef.current = Date.now();
      setConnected(true);
      setStatus('connected');
      setLastConnectedAt(new Date().toISOString());
      scheduleHeartbeatTimeout();
      scheduleStaleConnectionTimeout();
    });

    es.addEventListener('heartbeat', () => {
      scheduleHeartbeatTimeout();
      scheduleStaleConnectionTimeout();
    });

    es.addEventListener('operational', (nativeEvent) => {
      const parsed = parseEventData(nativeEvent.data);
      if (shouldIgnoreEvent(parsed)) return;

      if (parsed.id && seenEventIdsRef.current.has(parsed.id)) {
        return;
      }
      if (parsed.id) {
        seenEventIdsRef.current.add(parsed.id);
        if (seenEventIdsRef.current.size > MAX_SEEN_EVENT_IDS) {
          const first = seenEventIdsRef.current.values().next().value;
          if (first) seenEventIdsRef.current.delete(first);
        }
      }

      scheduleHeartbeatTimeout();
      scheduleStaleConnectionTimeout();
      setConnected(true);
      setStatus('connected');
      setLastEvent(parsed);
      setEventCount((prev) => prev + 1);
      setRecentEvents((prev) => [parsed, ...prev].slice(0, MAX_RECENT_EVENTS));
      trackThroughput();
      emitSyncEvent(syncEvents.realtimeEvent, parsed);
      dispatchToSubscribers(parsed);
    });

    es.onerror = () => {
      if (authExpiredRef.current || !localStorage.getItem('token')) {
        stopRealtime(authExpiredRef.current ? 'auth-expired' : 'disabled');
        return;
      }

      setConnected(false);
      setStatus('reconnecting');
      setLastDisconnectedAt(new Date().toISOString());
      clearHeartbeatTimer();
      clearStaleTimer();
      es.close();

      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }

      scheduleReconnect(connect);
    };
  }, [clearHeartbeatTimer, clearReconnectTimer, clearStaleTimer, dispatchToSubscribers, isAuthenticated, markAuthExpired, scheduleHeartbeatTimeout, scheduleReconnect, scheduleStaleConnectionTimeout, sessionExpired, stopRealtime, trackThroughput]);

  const subscribe = useCallback((type, handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }

    const key = type || '*';
    if (!listenersRef.current.has(key)) {
      listenersRef.current.set(key, new Set());
    }
    listenersRef.current.get(key).add(handler);

    return () => {
      const set = listenersRef.current.get(key);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) listenersRef.current.delete(key);
    };
  }, []);

  const unsubscribe = useCallback((type, handler) => {
    const key = type || '*';
    const set = listenersRef.current.get(key);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) listenersRef.current.delete(key);
  }, []);

  useEffect(() => {
    if (!realtimeEnabledRef.current) {
      setStatus('disabled');
      setConnected(false);
      return () => {};
    }

    const listeners = listenersRef.current;
    const seenEventIds = seenEventIdsRef.current;

    void connect();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !connectedRef.current) {
        void connect();
      }
    };

    const onOnline = () => {
      if (!connectedRef.current) void connect();
    };

    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      clearHeartbeatTimer();
      clearStaleTimer();
      clearReconnectTimer();
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      sourceRef.current?.close?.();
      listeners.clear();
      seenEventIds.clear();
    };
  }, [clearHeartbeatTimer, clearReconnectTimer, clearStaleTimer, connect]);

  const value = useMemo(() => ({
    connected,
    lastEvent,
    eventCount,
    status,
    recentEvents,
    reconnectCount,
    authFailures,
    staleConnections,
    throughputPerMinute,
    lastConnectedAt,
    lastDisconnectedAt,
    subscribe,
    unsubscribe,
    reconnect: connect,
  }), [connected, lastEvent, eventCount, status, recentEvents, reconnectCount, authFailures, staleConnections, throughputPerMinute, lastConnectedAt, lastDisconnectedAt, subscribe, unsubscribe, connect]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('[v4-painel] useRealtime deve ser usado dentro de <RealtimeProvider>');
  return ctx;
}

export default memo(RealtimeProvider);

