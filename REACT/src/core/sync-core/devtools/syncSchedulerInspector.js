export function createSyncSchedulerInspector({ refreshQueue, timeline }) {
  return {
    snapshot() {
      return refreshQueue.snapshot();
    },

    byPriority() {
      return this.snapshot().slice().sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    },

    recent(limit = 30) {
      return timeline.list({ type: 'scheduler' }).slice(-limit);
    },
  };
}
