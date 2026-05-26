/**
 * Gateway Bootstrap
 * 
 * Inicializa e registra todos os módulos na aplicação
 * Aplica middleware do gateway para monitoramento e circuit breaker
 */

import { Application, Request, Response } from 'express';
import { gatewayMiddleware, getGatewayStats, gatewayHealthCheck } from './gateway.middleware';
import { modules, getModuleStats, getModulesByDomain } from './module-registry';
import logger from '../shared/container/logger';

/**
 * Registra todos os módulos na aplicação Express
 */
export function bootstrapGateway(app: Application): void {
  logger.info('🚀 [Gateway] Carregando módulos...');

  // Aplica middleware do gateway globalmente
  app.use(gatewayMiddleware);

  // Endpoints de monitoramento do gateway
  app.get('/api/v1/gateway/stats', getGatewayStats);
  app.get('/api/v1/gateway/health', gatewayHealthCheck);
  app.get('/api/v1/gateway/modules', (_req: Request, res: Response) => {
    res.json(getModuleStats());
  });

  // Registra cada módulo
  let registeredCount = 0;
  let skippedCount = 0;

  modules.forEach(module => {
    if (!module.enabled) {
      skippedCount++;
      return;
    }

    try {
      app.use(module.basePath, module.router);
      registeredCount++;
    } catch (error: any) {
      logger.error(`[Gateway] ✗ Erro ao registrar módulo '${module.name}': ${error.message}`);
    }
  });

  // Resumo compacto
  logger.info(`✅ [Gateway] ${registeredCount} módulos ativos${skippedCount > 0 ? `, ${skippedCount} ignorados` : ''}`);
  
  // Log detalhado apenas em modo debug
  if (process.env.LOG_GATEWAY === 'true') {
    const byDomain = getModulesByDomain();
    logger.info('[Gateway] Detalhamento por domínio:');
    byDomain.forEach((mods, domain) => {
      const enabledMods = mods.filter(m => m.enabled);
      const names = enabledMods.map(m => m.name).join(', ');
      logger.info(`  ${domain}: ${names}`);
    });
  }
}

/**
 * Informações sobre a estrutura de módulos
 */
export function getGatewayInfo() {
  const stats = getModuleStats();
  return {
    gateway: {
      version: '1.0.0',
      architecture: 'modular-monolith',
      readyForMicroservices: true,
    },
    modules: stats,
    features: {
      circuitBreaker: true,
      rateLimit: true,
      logging: true,
      metrics: true,
      healthCheck: true,
    },
  };
}
