/**
 * Contratos Module - Central Exports
 */

// DTOs
export * from './dtos/contrato.dto';

// Repository
export { IContratoRepository, ContratoRepository } from './repositories/contrato.repository';

// Service
export { ContratoService } from './services/contrato.service';

// Controller
export { ContratoController } from './controllers/contrato.controller';

// Routes
export { default as contratoRoutes } from './contrato.routes';
