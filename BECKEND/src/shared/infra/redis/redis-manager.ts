/**
 * RedisManager — Centralized fault-tolerant Redis client.
 *
 * Design principles (Stripe/Linear-grade):
 *  - Single shared client across the entire process
 *  - All public methods return null/false on failure — NEVER throw
 *  - Exponential backoff reconnect (1 s → 30 s ceiling, max 15 attempts)
 *  - Health states: disconnected → connecting → connected ↔ degraded
 *  - Zero startup crash: connect() is safe to call without await
 *  - Error events always handled — no uncaughtException from Redis
 */

import { createClient, RedisClientType } from 'redis';
import logger from '@shared/container/logger';

export type RedisState = 'disconnected' | 'connecting' | 'connected' | 'degraded';

const BASE_DELAY_MS       = 1_000;
const MAX_DELAY_MS        = 30_000;
const MAX_RECONNECT       = 15;

class RedisManager {
  private static instance: RedisManager;

  private client: RedisClientType | null = null;
  private state: RedisState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url = '';
  private enabled = false;

  private constructor() {}

  static getInstance(): RedisManager {
    if (!RedisManager.instance) RedisManager.instance = new RedisManager();
    return RedisManager.instance;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Initiates connection. Safe to call without await — never rejects. */
  connect(url: string, enabled = true): void {
    if (!enabled) {
      logger.warn('[RedisManager] Redis desabilitado via configuração');
      this.state = 'disconnected';
      return;
    }

    if (this.state === 'connecting' || this.state === 'connected') return;

    this.url     = url;
    this.enabled = true;
    void this._connect();
  }

  isConnected(): boolean { return this.state === 'connected'; }
  getState(): RedisState  { return this.state; }
  isEnabled(): boolean    { return this.enabled; }

  async get(key: string): Promise<string | null> {
    if (!this._ready()) return null;
    try   { return await this.client!.get(key); }
    catch (e: any) { this._onOpError('get', e); return null; }
  }

  async setEx(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    if (!this._ready()) return false;
    try   { await this.client!.setEx(key, ttlSeconds, value); return true; }
    catch (e: any) { this._onOpError('setEx', e); return false; }
  }

  async del(key: string | string[]): Promise<boolean> {
    if (!this._ready()) return false;
    try   { await this.client!.del(key as string); return true; }
    catch (e: any) { this._onOpError('del', e); return false; }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this._ready()) return [];
    try   { return await this.client!.keys(pattern); }
    catch (e: any) { this._onOpError('keys', e); return []; }
  }

  async ping(): Promise<string> {
    if (!this._ready()) return 'UNAVAILABLE';
    try   { return await this.client!.ping(); }
    catch  { return 'ERROR'; }
  }

  async disconnect(): Promise<void> {
    this._clearReconnectTimer();
    this.enabled = false;
    this.state   = 'disconnected';
    if (this.client) {
      try { await this.client.quit(); } catch {}
      this.client = null;
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async _connect(): Promise<void> {
    this.state = 'connecting';

    try {
      const client = createClient({
        url: this.url,
        socket: {
          connectTimeout: 5_000,
          // Disable built-in retry — we manage reconnect ourselves for full control
          reconnectStrategy: false,
        },
      }) as RedisClientType;

      // Register error handler BEFORE connect() to prevent unhandled error events
      client.on('error', (err: Error) => {
        logger.warn(`[RedisManager] Error: ${err.message}`);
        if (this.state === 'connected') {
          this.state = 'degraded';
          this.client = null;
          this._scheduleReconnect();
        }
      });

      client.on('end', () => {
        logger.warn('[RedisManager] Conexão encerrada');
        if (this.state === 'connected') {
          this.state = 'degraded';
          this.client = null;
          this._scheduleReconnect();
        }
      });

      await client.connect();

      this.client             = client;
      this.state              = 'connected';
      this.reconnectAttempts  = 0;
      logger.info('[RedisManager] ✅ Conectado');

    } catch (err: any) {
      logger.warn(`[RedisManager] Falha na conexão: ${err.message}`);
      this.client = null;
      this.state  = 'degraded';
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (!this.enabled) return;
    if (this.reconnectTimer) return;

    if (this.reconnectAttempts >= MAX_RECONNECT) {
      logger.error(
        `[RedisManager] ${MAX_RECONNECT} tentativas esgotadas — modo degraded permanente. ` +
        'A aplicação continua funcionando sem Redis.'
      );
      this.state = 'degraded';
      return;
    }

    const delay = Math.min(BASE_DELAY_MS * 2 ** this.reconnectAttempts, MAX_DELAY_MS);
    this.reconnectAttempts++;

    logger.info(
      `[RedisManager] Reconectando em ${delay / 1000}s ` +
      `(tentativa ${this.reconnectAttempts}/${MAX_RECONNECT})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this._connect();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _ready(): boolean {
    return this.state === 'connected' && this.client !== null;
  }

  private _onOpError(op: string, err: Error): void {
    logger.warn(`[RedisManager] ${op} falhou: ${err.message}`);
    // Mark degraded so next check skips Redis and uses fallback
    if (this.state === 'connected') {
      this.state = 'degraded';
      this._scheduleReconnect();
    }
  }
}

export const redisManager = RedisManager.getInstance();
export default redisManager;
