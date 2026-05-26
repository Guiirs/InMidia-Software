export function createRuntimeLifecycle(metrics) {
  let startedAt = Date.now();
  let state = 'starting';
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener({ state, startedAt }));

  return {
    start() {
      state = 'running';
      startedAt = Date.now();
      metrics?.increment?.('runtimeStarts');
      notify();
    },
    pause(reason = 'manual') {
      state = 'paused';
      metrics?.increment?.('runtimePauses');
      notify();
      return reason;
    },
    resume() {
      state = 'running';
      metrics?.increment?.('runtimeResumes');
      notify();
    },
    stop() {
      state = 'stopped';
      metrics?.increment?.('runtimeStops');
      notify();
    },
    getState() {
      return { state, startedAt, uptimeMs: Date.now() - startedAt };
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(this.getState());
      return () => listeners.delete(listener);
    },
  };
}
