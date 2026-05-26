import logger from '@shared/container/logger';

const ONE_MINUTE_MS = 60_000;

type EventStamp = {
  timestamp: number;
};

class RealtimeMetrics {
  private activeClients = 0;
  private activeEventListeners = 0;

  private readonly eventStamps: EventStamp[] = [];
  private readonly connectionStamps: EventStamp[] = [];
  private readonly authFailureStamps: EventStamp[] = [];

  private totalConnections = 0;
  private totalDisconnections = 0;
  private totalAuthFailures = 0;
  private totalEventsEmitted = 0;

  private prune(now: number): void {
    const cutoff = now - ONE_MINUTE_MS;
    while (this.eventStamps.length && this.eventStamps[0]!.timestamp < cutoff) this.eventStamps.shift();
    while (this.connectionStamps.length && this.connectionStamps[0]!.timestamp < cutoff) this.connectionStamps.shift();
    while (this.authFailureStamps.length && this.authFailureStamps[0]!.timestamp < cutoff) this.authFailureStamps.shift();
  }

  recordSseConnected(meta: { companyId: string; userId: string }): void {
    const now = Date.now();
    this.activeClients += 1;
    this.totalConnections += 1;
    this.connectionStamps.push({ timestamp: now });
    this.prune(now);

    logger.info(`[RealtimeMetrics] SSE connect company=${meta.companyId} user=${meta.userId} active=${this.activeClients}`);
  }

  recordSseDisconnected(meta: { companyId: string; userId: string }): void {
    const now = Date.now();
    this.activeClients = Math.max(0, this.activeClients - 1);
    this.totalDisconnections += 1;
    this.prune(now);

    logger.info(`[RealtimeMetrics] SSE disconnect company=${meta.companyId} user=${meta.userId} active=${this.activeClients}`);
  }

  recordAuthFailure(reason: string): void {
    const now = Date.now();
    this.totalAuthFailures += 1;
    this.authFailureStamps.push({ timestamp: now });
    this.prune(now);

    logger.warn(`[RealtimeMetrics] Stream auth failure reason=${reason}`);
  }

  recordEventEmitted(): void {
    const now = Date.now();
    this.totalEventsEmitted += 1;
    this.eventStamps.push({ timestamp: now });
    this.prune(now);
  }

  setActiveEventListeners(count: number): void {
    this.activeEventListeners = Math.max(0, count);
  }

  snapshot() {
    const now = Date.now();
    this.prune(now);

    const memory = process.memoryUsage();

    return {
      connectedClients: this.activeClients,
      emittedLastMinute: this.eventStamps.length,
      activeListeners: this.activeEventListeners,
      uptime: Math.round(process.uptime()),
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
      },
      reconnectRate: this.connectionStamps.length,
      authFailuresLastMinute: this.authFailureStamps.length,
      totals: {
        connections: this.totalConnections,
        disconnections: this.totalDisconnections,
        authFailures: this.totalAuthFailures,
        eventsEmitted: this.totalEventsEmitted,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const realtimeMetrics = new RealtimeMetrics();
