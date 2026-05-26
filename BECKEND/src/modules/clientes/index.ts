/**
 * Cliente Module - Central Export
 * 
 * Exporta tudo relacionado ao módulo de Clientes
 */

// DTOs e Types
export type {
  CreateClienteDTO,
  UpdateClienteDTO,
  ListClientesQueryDTO,
  ClienteLogoDTO,
  ClienteEntity,
  ClienteListItem,
  PaginatedClientesResponse
} from './dtos/cliente.dto';

export {
  CreateClienteSchema,
  UpdateClienteSchema,
  ListClientesQuerySchema,
  ClienteLogoSchema,
  validateCreateCliente,
  validateUpdateCliente,
  validateListQuery,
  validateClienteLogo,
  toListItem,
  toListItems
} from './dtos/cliente.dto';

// Repository
export type { IClienteRepository } from './repositories/cliente.repository';
export { ClienteRepository } from './repositories/cliente.repository';

// Service
export { ClienteService } from './services/cliente.service';

// Controller
export { ClienteController } from './controllers/cliente.controller';

// Routes
export { default as clienteRoutes } from './cliente.routes';
