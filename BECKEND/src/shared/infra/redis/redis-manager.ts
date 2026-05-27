/**
 * RedisManager — Centralized fault-tolerant Redis client.
 *
 * Design:
 *  - Extends EventEmitter → emits 'ready' on connect, 'degraded' on failure
 *  - waitUntilReady(ms) → Promise that resolves true/false after timeout
 *  - All public ops return null/false on failure — NEVER throw
 *  - Exponential backoff (1 s → 30 s, max 15 attempts)
 *  - Health states: disconnected → connecting → connected ↔ degraded
 *  - Diagnostic logs for every state transition
 */

import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';
import logger from '@shared/container/logger';

export type RedisState = 'disconnected' | 'connecting' | 'connected' | 'degraded';

const BASE_DELAY_MS  = 1_000;
const MAX_DELAY_MS   = 30_000;
const MAX_RECONNECT  = 15;

class RedisManager extends EventEmitter {
  private static instance: RedisManager;

  private client: RedisClientType | null = null;
  private _state: RedisState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url = '';
  private enabled = false;

  private constructor() { super(); }

  static getInstance(): RedisManager {
    if (!RedisManager.instance) RedisManager.instance = new RedisManager();
    return RedisManager.instance;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Initiates connection. Safe to call without await — never rejects.
   * Emits 'ready' when connected, 'degraded' on failure.
   */
  connect(url: string, enabled = true): void {
    // ── Diagnostic log 1: was connect() actually called? ──
    logger.info(
      `[RedisManager] connect() chamado — enabled=${enabled} ` +
      `url=${url ? url.replace(/\/\/.*@/, '//<credentials>@').replace(/127\.0\.0\.1|localhost/, '<host>') : 'UNDEFINED'}`
    );

    if (!enabled) {
      logger.warn('[RedisManager] Redis desabilitado (REDIS_ENABLED=false)');
      this._setState('disconnected');
      return;
    }

    if (!url) {
      logger.error('[RedisManager] REDIS_URL está undefined/vazio — verifique o .env ou env vars do Coolify');
      this._setState('degraded');
      return;
    }

    if (this._state === 'connecting' || this._state === 'connected') {
      logger.debug(`[RedisManager] connect() ignorado — já em estado '${this._state}'`);
      return;
    }

    this.url     = url;
    this.enabled = true;
    void this._connect();
  }

  /**
   * Waits up to `timeoutMs` for the manager to reach 'connected' state.
   * Returns true if connected within timeout, false otherwise.
   * Safe to call even if already connected.
   */
  waitUntilReady(timeoutMs = 5_000): Promise<boolean> {
    if (this._state === 'connected') return Promise.resolve(true);
    if (!this.enabled || this._state === 'disconnected') return Promise.resolve(false);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeListener('ready', onReady);
        logger.warn(`[RedisManager] waitUntilReady expirou após ${timeoutMs}ms — estado atual: ${this._state}`);
        resolve(false);
      }, timeoutMs);

      const onReady = () => {
        clearTimeout(timer);
        resolve(true);
      };

      this.once('ready', onReady);
    });
  }

  isConnected(): boolean { return this._state === 'connected'; }
  getState(): RedisState  { return this._state; }
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
    try   {
      if (Array.isArray(key)) { await this.client!.del(key); }
      else                    { await this.client!.del(key); }
      return true;
    }
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
    this._setState('disconnected');
    if (this.client) {
      try { await this.client.quit(); } catch {}
      this.client = null;
    }
    logger.info('[RedisManager] Desconectado manualmente');
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async _connect(): Promise<void> {
    this._setState('connecting');
    logger.info(`[RedisManager] Tentando conectar (attempt=${this.reconnectAttempts + 1})`);

    try {
      const client = createClient({
        url: this.url,
        socket: {
          connectTimeout: 5_000,
          reconnectStrategy: false, // We own the retry loop
        },
      }) as RedisClientType;

      // Error handler MUST be registered before connect() to prevent
      // unhandled 'error' events that crash Node.js
      client.on('error', (err: Error) => {
        logger.warn(`[RedisManager] Erro no cliente: ${err.message}`);
        if (this._state === 'connected') {
          this.client = null;
          this._setState('degraded');
          this.emit('degraded');
          this._scheduleReconnect();
        }
      });

      client.on('end', () => {
        logger.warn('[RedisManager] Conexão encerrada pelo servidor');
        if (this._state === 'connected') {
          this.client = null;
          this._setState('degraded');
          this.emit('degraded');
          this._scheduleReconnect();
        }
      });

      await client.connect();

      this.client            = client;
      this.reconnectAttempts = 0;
      this._setState('connected');
      this.emit('ready');
      logger.info('[RedisManager] ✅ Conectado com sucesso');

    } catch (err: any) {
      logger.warn(`[RedisManager] Falha na conexão: ${err.message}`);
      this.client = null;
      this._setState('degraded');
      this.emit('degraded');
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (!this.enabled) return;
    if (this.reconnectTimer) return;

    if (this.reconnectAttempts >= MAX_RECONNECT) {
      logger.error(
        `[RedisManager] ${MAX_RECONNECT} tentativas esgotadas — degraded permanente. ` +
        'App continua funcionando com fallback memory.'
      );
      return;
    }

    const delay = Math.min(BASE_DELAY_MS * 2 ** this.reconnectAttempts, MAX_DELAY_MS);
    this.reconnectAttempts++;

    logger.info(`[RedisManager] Reconectando em ${delay / 1000}s (tentativa ${this.reconnectAttempts}/${MAX_RECONNECT})`);

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

  private _setState(s: RedisState): void {
    if (this._state !== s) {
      logger.debug(`[RedisManager] state: ${this._state} → ${s}`);
      this._state = s;
    }
  }

  private _ready(): boolean {
    return this._state === 'connected' && this.client !== null;
  }

  private _onOpError(op: string, err: Error): void {
    logger.warn(`[RedisManager] ${op} falhou: ${err.message}`);
    if (this._state === 'connected') {
      this._setState('degraded');
      this._scheduleReconnect();
    }
  }
}

export const redisManager = RedisManager.getInstance();
export default redisManager;
