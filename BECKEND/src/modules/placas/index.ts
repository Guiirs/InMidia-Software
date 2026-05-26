/**
 * Placa Module - Central Export
 */

// DTOs e Types
export type {
  CreatePlacaDTO,
  UpdatePlacaDTO,
  ListPlacasQueryDTO,
  PlacaImageDTO,
  CheckDisponibilidadeDTO,
  ReorderPlacasDTO,
  PlacaEntity,
  PlacaListItem,
  PaginatedPlacasResponse,
  DisponibilidadeResponse
} from './dtos/placa.dto';

export {
  CreatePlacaSchema,
  UpdatePlacaSchema,
  ListPlacasQuerySchema,
  PlacaImageSchema,
  CheckDisponibilidadeSchema,
  validateCreatePlaca,
  validateUpdatePlaca,
  validateListQuery,
  validatePlacaImage,
  validateCheckDisponibilidade,
  validateReorderPlacas,
  toListItem,
  toListItems
} from './dtos/placa.dto';

// Repository
export type { IPlacaRepository } from './repositories/placa.repository';
export { PlacaRepository } from './repositories/placa.repository';

// Service
export { PlacaService } from './services/placa.service';

// Controller
export { PlacaController } from './controllers/placa.controller';

// Routes
export { default as placaRoutes } from './placas.routes';
