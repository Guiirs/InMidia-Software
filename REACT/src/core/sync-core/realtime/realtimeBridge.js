import { useEffect } from 'react';

export function installRealtimeBridgeListeners({
  invalidateByEvent,
  clearProtectedCache,
  replayQueuedInvalidations,
  devtools,
  target = window,
}) {
  const onRealtimeEvent = (event) => {
    const type = event?.detail?.type ?? event?.detail?.eventType;
    if (type) invalidateByEvent(type, { debounceMs: 900 });
  };
  const onAuthExpired = () => clearProtectedCache('auth-expired');
  const onReconnect = (event) => {
    devtools?.record?.({
      type: 'reconnect',
      event: 'realtime.reconnect',
      metadata: event?.detail ?? {},
    });
    replayQueuedInvalidations?.(event?.detail ?? {});
  };

  target.addEventListener('sync:realtime-event', onRealtimeEvent);
  target.addEventListener('sync:realtime-reconnect', onReconnect);
  target.addEventListener('auth:expired', onAuthExpired);

  return () => {
    target.removeEventListener('sync:realtime-event', onRealtimeEvent);
    target.removeEventListener('sync:realtime-reconnect', onReconnect);
    target.removeEventListener('auth:expired', onAuthExpired);
  };
}

export default function RealtimeBridge({ invalidateByEvent, clearProtectedCache, replayQueuedInvalidations, devtools }) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    return installRealtimeBridgeListeners({ invalidateByEvent, clearProtectedCache, replayQueuedInvalidations, devtools });
  }, [clearProtectedCache, devtools, invalidateByEvent, replayQueuedInvalidations]);

  return null;
}
