import type { RealtimeEvent, RealtimeStream, RealtimeStreamName } from '../contracts/realtime.contracts';

const STREAM_NAMES: RealtimeStreamName[] = ['inventory', 'dashboard', 'spatial', 'diagnostics', 'projections'];

export class RealtimeStreamStore {
  private readonly streams = new Map<RealtimeStreamName, RealtimeStream>();
  private readonly maxEventsPerStream: number;

  constructor(maxEventsPerStream = 200) {
    this.maxEventsPerStream = maxEventsPerStream;
    STREAM_NAMES.forEach((name) => {
      this.streams.set(name, {
        name,
        events: [],
        version: 0,
        failures: 0,
      });
    });
  }

  append(streamName: RealtimeStreamName, event: RealtimeEvent): RealtimeEvent {
    const stream = this.getStream(streamName);
    stream.version += 1;
    stream.events.push(event);
    stream.lastEventAt = event.metadata.occurredAt;

    if (stream.events.length > this.maxEventsPerStream) {
      stream.events.shift();
    }

    return event;
  }

  markFailure(streamName: RealtimeStreamName): void {
    this.getStream(streamName).failures += 1;
  }

  getStream(streamName: RealtimeStreamName): RealtimeStream {
    const stream = this.streams.get(streamName);
    if (!stream) {
      throw new Error(`Unknown realtime stream: ${streamName}`);
    }
    return stream;
  }

  list(): RealtimeStream[] {
    return Array.from(this.streams.values()).map((stream) => ({
      ...stream,
      events: [...stream.events],
    }));
  }

  getVersion(streamName: RealtimeStreamName): number {
    return this.getStream(streamName).version;
  }

  clear(): void {
    this.streams.clear();
    STREAM_NAMES.forEach((name) => {
      this.streams.set(name, {
        name,
        events: [],
        version: 0,
        failures: 0,
      });
    });
  }
}

export const realtimeStreamStore = new RealtimeStreamStore();
