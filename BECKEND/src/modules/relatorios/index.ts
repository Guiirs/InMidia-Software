/**
 * Módulo Relatorios - Exports
 */

// DTOs
export * from './dtos/relatorio.dto';

// Repository
export { RelatorioRepository } from './repositories/relatorio.repository';
export type { IRelatorioRepository } from './repositories/relatorio.repository';

// Service
export { RelatorioService } from './services/relatorio.service';

// Controller
export { RelatorioController } from './controllers/relatorio.controller';

// Routes
export { default as relatoriosRoutes } from './relatorios.routes';
