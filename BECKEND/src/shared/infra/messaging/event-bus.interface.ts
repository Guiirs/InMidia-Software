// src/shared/infra/messaging/event-bus.interface.ts
export interface EventBus {
  publish(topic: string, message: any): Promise<void>;
  subscribe(topic: string, callback: (message: any) => void | Promise<void>): Promise<void>;
  unsubscribe(topic: string): Promise<void>;
  close(): Promise<void>;
}