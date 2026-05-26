/**
 * Módulo Regiões - Exports
 */

// DTOs
export * from './dtos/regiao.dto';

// Repository
export { RegiaoRepository } from './repositories/regiao.repository';
export type { IRegiaoRepository } from './repositories/regiao.repository';

// Service
export { RegiaoService } from './services/regiao.service';

// Controller
export { RegiaoController } from './controllers/regiao.controller';

// Routes
export { default as regiaoRoutes } from './regiao.routes';
