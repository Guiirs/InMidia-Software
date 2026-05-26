/**
 * Singleton Managers - Type-Safe Global Services
 * 
 * Implementa o padrão Singleton para serviços globais críticos
 * com type safety completo e lazy initialization.
 */

import mongoose, { Connection, ConnectOptions } from 'mongoose';
import { createClient, RedisClientType } from 'redis';
import winston, { Logger } from 'winston';
import { Result } from './Result';
import { DatabaseError, CacheError, InternalError } from './DomainError';

// ============================================
// DATABASE MANAGER (Singleton)
// ============================================

export interface DatabaseConfig {
  uri: string;
  options?: ConnectOptions;
  onConnect?: () => void;
  onError?: (error: Error) => void;
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private connection: Connection | null = null;
  private isConnecting = false;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Inicializa a conexão com o banco de dados
   */
  async initialize(config: DatabaseConfig): Promise<Result<Connection, DatabaseError>> {
    if (this.connection) {
      return Result.ok(this.connection);
    }

    if (this.isConnecting) {
      // Aguarda conexão em andamento
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.connection 
        ? Result.ok(this.connection)
        : Result.fail(new DatabaseError('initialize', 'Conexão falhou'));
    }

    this.isConnecting = true;

    try {
      await mongoose.connect(config.uri, config.options);
      this.connection = mongoose.connection;

      this.connection.on('error', (error) => {
        config.onError?.(error);
      });

      this.connection.on('disconnected', () => {
        this.connection = null;
      });

      config.onConnect?.();
      return Result.ok(this.connection);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new DatabaseError('connect', err.message));
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Retorna a conexão atual (lança erro se não inicializada)
   */
  getConnection(): Connection {
    if (!this.connection) {
      throw new DatabaseError('getConnection', 'Banco de dados não inicializado');
    }
    return this.connection;
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.connection?.readyState === 1;
  }

  /**
   * Desconecta do banco de dados
   */
  async disconnect(): Promise<Result<void, DatabaseError>> {
    if (!this.connection) {
      return Result.ok(undefined);
    }

    try {
      await mongoose.disconnect();
      this.connection = null;
      return Result.ok(undefined);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new DatabaseError('disconnect', err.message));
    }
  }

  /**
   * Executa health check
   */
  async healthCheck(): Promise<Result<{ status: string; latency: number }, DatabaseError>> {
    if (!this.isConnected()) {
      return Result.fail(new DatabaseError('healthCheck', 'Não conectado'));
    }

    if (!mongoose.connection.db) {
      return Result.fail(new DatabaseError('healthCheck', 'Database não disponível'));
    }

    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      const latency = Date.now() - start;

      return Result.ok({
        status: 'connected',
        latency
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new DatabaseError('healthCheck', err.message));
    }
  }
}

export const DB = DatabaseManager.getInstance();

// ============================================
// CACHE MANAGER (Singleton)
// ============================================

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  ttl?: number; // TTL padrão em segundos
  onConnect?: () => void;
  onError?: (error: Error) => void;
}

class CacheManager {
  private static instance: CacheManager;
  private client: RedisClientType | null = null;
  private config: CacheConfig | null = null;
  private isConnecting = false;

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Inicializa a conexão com o Redis
   */
  async initialize(config: CacheConfig): Promise<Result<RedisClientType, CacheError>> {
    if (this.client?.isOpen) {
      return Result.ok(this.client);
    }

    if (this.isConnecting) {
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.client && this.client.isOpen
        ? Result.ok(this.client)
        : Result.fail(new CacheError('initialize'));
    }

    this.isConnecting = true;
    this.config = config;

    try {
      this.client = createClient({
        socket: {
          host: config.host,
          port: config.port
        },
        password: config.password,
        database: config.db
      });

      this.client.on('error', (error) => {
        config.onError?.(error);
      });

      await this.client.connect();
      config.onConnect?.();

      return Result.ok(this.client);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new CacheError(`connect: ${err.message}`));
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Retorna o client Redis (lança erro se não inicializado)
   */
  getClient(): RedisClientType {
    if (!this.client?.isOpen) {
      throw new CacheError('getClient: Cache não inicializado');
    }
    return this.client;
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.client?.isOpen ?? false;
  }

  /**
   * Get com type safety
   */
  async get<T>(key: string): Promise<Result<T | null, CacheError>> {
    if (!this.isConnected()) {
      return Result.fail(new CacheError('get: Não conectado'));
    }

    try {
      const value = await this.client!.get(key);
      if (!value) {
        return Result.ok(null);
      }
      return Result.ok(JSON.parse(value) as T);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new CacheError(`get: ${err.message}`));
    }
  }

  /**
   * Set com type safety
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<Result<void, CacheError>> {
    if (!this.isConnected()) {
      return Result.fail(new CacheError('set: Não conectado'));
    }

    try {
      const serialized = JSON.stringify(value);
      const expirySeconds = ttl ?? this.config?.ttl ?? 3600;

      await this.client!.setEx(key, expirySeconds, serialized);
      return Result.ok(undefined);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new CacheError(`set: ${err.message}`));
    }
  }

  /**
   * Delete
   */
  async del(key: string | string[]): Promise<Result<number, CacheError>> {
    if (!this.isConnected()) {
      return Result.fail(new CacheError('del: Não conectado'));
    }

    try {
      const keys = Array.isArray(key) ? key : [key];
      const count = await this.client!.del(keys);
      return Result.ok(count);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new CacheError(`del: ${err.message}`));
    }
  }

  /**
   * Verifica se existe
   */
  async exists(key: string): Promise<Result<boolean, CacheError>> {
    if (!this.isConnected()) {
      return Result.fail(new CacheError('exists: Não conectado'));
    }

    try {
      const count = await this.client!.exists(key);
      return Result.ok(count > 0);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new CacheError(`exists: ${err.message}`));
    }
  }

  /**
   * Limpa por padrão
   */
  async clear(pattern?: string): Promise<Result<number, CacheError>> {
    if (!this.isConnected()) {
      return Result.fail(new CacheError('clear: Não conectado'));
    }

    try {
      const keys = pattern 
        ? await this.client!.keys(pattern)
        : await this.client!.keys('*');

      if (keys.length === 0) {
        return Result.ok(0);
      }

      const count = await this.client!.del(keys);
      return Result.ok(count);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new CacheError(`clear: ${err.message}`));
    }
  }

  /**
   * Desconecta
   */
  async disconnect(): Promise<Result<void, CacheError>> {
    if (!this.client) {
      return Result.ok(undefined);
    }

    try {
      await this.client.quit();
      this.client = null;
      return Result.ok(undefined);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new CacheError(`disconnect: ${err.message}`));
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<Result<{ status: string; latency: number }, CacheError>> {
    if (!this.isConnected()) {
      return Result.fail(new CacheError('healthCheck: Não conectado'));
    }

    try {
      const start = Date.now();
      await this.client!.ping();
      const latency = Date.now() - start;

      return Result.ok({
        status: 'connected',
        latency
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new CacheError(`healthCheck: ${err.message}`));
    }
  }
}

export const Cache = CacheManager.getInstance();

// ============================================
// LOGGER MANAGER (Singleton)
// ============================================

export interface LoggerConfig {
  level?: string;
  format?: winston.Logform.Format;
  transports?: winston.transport[];
  defaultMeta?: Record<string, any>;
}

class LoggerManager {
  private static instance: LoggerManager;
  private logger: Logger | null = null;

  private constructor() {}

  static getInstance(): LoggerManager {
    if (!LoggerManager.instance) {
      LoggerManager.instance = new LoggerManager();
    }
    return LoggerManager.instance;
  }

  /**
   * Inicializa o logger
   */
  initialize(config?: LoggerConfig): Result<Logger, InternalError> {
    if (this.logger) {
      return Result.ok(this.logger);
    }

    try {
      const defaultFormat = winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      );

      const defaultTransports = [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ];

      this.logger = winston.createLogger({
        level: config?.level ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        format: config?.format ?? defaultFormat,
        transports: config?.transports ?? defaultTransports,
        defaultMeta: config?.defaultMeta
      });

      return Result.ok(this.logger);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Result.fail(new InternalError(`Logger initialization failed: ${err.message}`));
    }
  }

  /**
   * Retorna o logger (cria um padrão se não inicializado)
   */
  getLogger(): Logger {
    if (!this.logger) {
      const result = this.initialize();
      if (result.isFailure) {
        throw result.error;
      }
    }
    return this.logger!;
  }

  /**
   * Métodos de conveniência
   */
  error(message: string, meta?: Record<string, any>): void {
    this.getLogger().error(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.getLogger().warn(message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.getLogger().info(message, meta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.getLogger().debug(message, meta);
  }

  verbose(message: string, meta?: Record<string, any>): void {
    this.getLogger().verbose(message, meta);
  }
}

export const Log = LoggerManager.getInstance();
