// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
/**
 * Health Controller
 * Endpoints de health check
 */
// src/modules/system/health/health.controller.ts
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import logger from '../../../shared/container/logger';
import cacheService from '../../../shared/container/cache.service';
import fs from 'fs';
import path from 'path';

/**
 * Health Check Detalhado
 * Verifica conexões com MongoDB, Redis e outros serviços externos
 * 
 * GET /api/v1/status
 * 
 * Retorna:
 * - 200: Todos os serviços saudáveis
 * - 503: Um ou mais serviços indisponíveis
 */
export async function healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();
  const checks: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {}
  };

  let isHealthy = true;

  // 1. Check MongoDB
  try {
    const mongoState = mongoose.connection.readyState;
    const stateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    checks.services.mongodb = {
      status: mongoState === 1 ? 'healthy' : 'unhealthy',
      state: stateMap[mongoState],
      message: mongoState === 1 ? 'Connected' : `State: ${stateMap[mongoState]}`
    };

    // Tenta ping no MongoDB
    if (mongoState === 1) {
      await mongoose.connection.db.admin().ping();
      checks.services.mongodb.ping = 'success';
    }

    if (mongoState !== 1) {
      isHealthy = false;
    }

  } catch (error: any) {
    logger.error('[HealthCheck] Erro ao verificar MongoDB:', error.message);
    checks.services.mongodb = {
      status: 'unhealthy',
      error: error.message
    };
    isHealthy = false;
  }

  // 2. Check Redis (se configurado)
  try {
    const redisAvailable = cacheService.isAvailable();
    
    if (process.env.REDIS_HOST) {
      // Redis está configurado, deve estar disponível
      checks.services.redis = {
        status: redisAvailable ? 'healthy' : 'unhealthy',
        message: redisAvailable ? 'Connected' : 'Connection failed'
      };

      if (!redisAvailable) {
        isHealthy = false;
      }
    } else {
      // Redis não configurado (não crítico em dev)
      checks.services.redis = {
        status: 'disabled',
        message: 'Not configured (using database fallback)'
      };
    }
  } catch (error: any) {
    logger.error('[HealthCheck] Erro ao verificar Redis:', error.message);
    checks.services.redis = {
      status: 'unhealthy',
      error: error.message
    };
    // Redis não é crítico em dev
    if (process.env.NODE_ENV === 'production') {
      isHealthy = false;
    }
  }

  // 3. Check File System (uploads directory)
  try {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    
    const accessible = fs.existsSync(uploadsDir);
    checks.services.filesystem = {
      status: accessible ? 'healthy' : 'unhealthy',
      uploads_dir: uploadsDir,
      writable: accessible ? true : false
    };

    if (!accessible) {
      isHealthy = false;
    }
  } catch (error: any) {
    logger.error('[HealthCheck] Erro ao verificar File System:', error.message);
    checks.services.filesystem = {
      status: 'unhealthy',
      error: error.message
    };
    isHealthy = false;
  }

  // 4. Memory usage
  const memUsage = process.memoryUsage();
  checks.memory = {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
  };

  // 5. Response time
  checks.responseTime = `${Date.now() - startTime}ms`;

  // Define status geral
  checks.status = isHealthy ? 'healthy' : 'unhealthy';

  // Retorna código apropriado
  const statusCode = isHealthy ? 200 : 503;

  if (!isHealthy) {
    logger.warn('[HealthCheck] Sistema com problemas:', checks);
  }

  res.status(statusCode).json(checks);
}

/**
 * Readiness Check
 * Verifica se a aplicação está pronta para receber tráfego
 * 
 * GET /api/v1/ready
 */
export async function readinessCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Verifica se MongoDB está conectado
    if (mongoose.connection.readyState !== 1) {
      res.status(503).json({
        ready: false,
        message: 'Database not ready'
      });
      return;
    }

    // Aplicação pronta
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('[ReadinessCheck] Erro:', error.message);
    res.status(503).json({
      ready: false,
      error: error.message
    });
  }
}

/**
 * Liveness Check
 * Verifica se a aplicação está viva (não travada)
 * 
 * GET /api/v1/live
 */
export function livenessCheck(req: Request, res: Response, next: NextFunction): void {
  // Se chegou aqui, o processo está vivo
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString()
  });
}

export default {
  healthCheck,
  readinessCheck,
  livenessCheck
};

