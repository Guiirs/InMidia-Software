/**
 * Service Factory
 * Centraliza a criação e gerenciamento de serviços com Dependency Injection
 */

import { ClienteRepository } from '@modules/clientes/repositories/cliente.repository';
import { ClienteService } from '@modules/clientes/services/cliente.service';
import { ClienteController } from '@modules/clientes/controllers/cliente.controller';

import { PlacaRepository } from '@modules/placas/repositories/placa.repository';
import { PlacaService } from '@modules/placas/services/placa.service';
import { PlacaController } from '@modules/placas/controllers/placa.controller';

import { ContratoRepository } from '@modules/contratos/repositories/contrato.repository';
import { ContratoService } from '@modules/contratos/services/contrato.service';
import { ContratoController } from '@modules/contratos/controllers/contrato.controller';

import { AluguelRepository } from '@modules/alugueis/repositories/aluguel.repository';
import { AluguelService } from '@modules/alugueis/services/aluguel.service';
import { AluguelController } from '@modules/alugueis/controllers/aluguel.controller';

/**
 * ServiceFactory - Singleton Pattern
 * 
 * Gerencia a criação de todas as camadas (Repository → Service → Controller)
 * garantindo uma única instância de cada serviço durante a vida da aplicação.
 * 
 * @example
 * ```typescript
 * const factory = ServiceFactory.getInstance();
 * const clienteController = factory.getClienteController();
 * ```
 */
export class ServiceFactory {
  private static instance: ServiceFactory;

  // Repositories
  private clienteRepository?: ClienteRepository;
  private placaRepository?: PlacaRepository;
  private contratoRepository?: ContratoRepository;
  private aluguelRepository?: AluguelRepository;

  // Services
  private clienteService?: ClienteService;
  private placaService?: PlacaService;
  private contratoService?: ContratoService;
  private aluguelService?: AluguelService;

  // Controllers
  private clienteController?: ClienteController;
  private placaController?: PlacaController;
  private contratoController?: ContratoController;
  private aluguelController?: AluguelController;

  private constructor() {
    // Private constructor para Singleton
  }

  /**
   * Retorna a instância única do ServiceFactory
   */
  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  // ============================================
  // CLIENTE MODULE
  // ============================================

  getClienteRepository(): ClienteRepository {
    if (!this.clienteRepository) {
      this.clienteRepository = new ClienteRepository();
    }
    return this.clienteRepository;
  }

  getClienteService(): ClienteService {
    if (!this.clienteService) {
      const repository = this.getClienteRepository();
      this.clienteService = new ClienteService(repository);
    }
    return this.clienteService;
  }

  getClienteController(): ClienteController {
    if (!this.clienteController) {
      const service = this.getClienteService();
      this.clienteController = new ClienteController(service);
    }
    return this.clienteController;
  }

  // ============================================
  // PLACA MODULE
  // ============================================

  getPlacaRepository(): PlacaRepository {
    if (!this.placaRepository) {
      this.placaRepository = new PlacaRepository();
    }
    return this.placaRepository;
  }

  getPlacaService(): PlacaService {
    if (!this.placaService) {
      const repository = this.getPlacaRepository();
      this.placaService = new PlacaService(repository);
    }
    return this.placaService;
  }

  getPlacaController(): PlacaController {
    if (!this.placaController) {
      const service = this.getPlacaService();
      this.placaController = new PlacaController(service);
    }
    return this.placaController;
  }

  // ============================================
  // CONTRATO MODULE
  // ============================================

  getContratoRepository(): ContratoRepository {
    if (!this.contratoRepository) {
      this.contratoRepository = new ContratoRepository();
    }
    return this.contratoRepository;
  }

  getContratoService(): ContratoService {
    if (!this.contratoService) {
      const repository = this.getContratoRepository();
      this.contratoService = new ContratoService(repository);
    }
    return this.contratoService;
  }

  getContratoController(): ContratoController {
    if (!this.contratoController) {
      const service = this.getContratoService();
      this.contratoController = new ContratoController(service);
    }
    return this.contratoController;
  }

  // ============================================
  // ALUGUEL MODULE
  // ============================================

  getAluguelRepository(): AluguelRepository {
    if (!this.aluguelRepository) {
      this.aluguelRepository = new AluguelRepository();
    }
    return this.aluguelRepository;
  }

  getAluguelService(): AluguelService {
    if (!this.aluguelService) {
      const repository = this.getAluguelRepository();
      this.aluguelService = new AluguelService(repository);
    }
    return this.aluguelService;
  }

  getAluguelController(): AluguelController {
    if (!this.aluguelController) {
      const service = this.getAluguelService();
      this.aluguelController = new AluguelController(service);
    }
    return this.aluguelController;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Reseta todas as instâncias (útil para testes)
   */
  reset(): void {
    this.clienteRepository = undefined;
    this.clienteService = undefined;
    this.clienteController = undefined;

    this.placaRepository = undefined;
    this.placaService = undefined;
    this.placaController = undefined;

    this.contratoRepository = undefined;
    this.contratoService = undefined;
    this.contratoController = undefined;

    this.aluguelRepository = undefined;
    this.aluguelService = undefined;
    this.aluguelController = undefined;
  }
}

/**
 * Export singleton instance
 */
export const serviceFactory = ServiceFactory.getInstance();
