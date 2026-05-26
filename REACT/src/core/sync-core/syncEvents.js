export const syncEvents = {
  authExpired: 'auth:expired',
  realtimeEvent: 'sync:realtime-event',
  resourceChanged: 'sync:resource-changed',
};

export function emitSyncEvent(type, detail) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}
