/**
 * Aluguéis Module - Central Exports
 */

// DTOs
export * from './dtos/aluguel.dto';

// Repository
export { IAluguelRepository, AluguelRepository } from './repositories/aluguel.repository';

// Service
export { AluguelService } from './services/aluguel.service';

// Controller
export { AluguelController } from './controllers/aluguel.controller';

// Routes
export { default as aluguelRoutes } from './aluguel.routes';
