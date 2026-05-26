/**
 * API Gateway - Export central
 */

export { gatewayMiddleware, getGatewayStats, gatewayHealthCheck } from './gateway.middleware';
export { gatewayConfig, findRoute, isModuleEnabled } from './gateway.config';
export { ServiceRoute, GatewayConfig } from './gateway.config';
export { bootstrapGateway, getGatewayInfo } from './bootstrap';
export { modules, getModulesByDomain, getModuleByName, getEnabledModules, getModuleStats } from './module-registry';
