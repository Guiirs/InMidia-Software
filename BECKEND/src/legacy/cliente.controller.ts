// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
/**
 * Cliente Controller (OLD)
 * DEPRECADO: Use controllers/cliente.controller.ts
 */
// src/controllers/clienteController.ts
import { Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express';
import { ClienteService } from './cliente.service';
import logger from '@shared/container/logger';
import cacheService from '@shared/container/cache.service';
import AppError from '@shared/container/AppError';

export class ClienteController {
    constructor(private clienteService: ClienteService) {}

    /**
     * Controller para criar um novo cliente.
     * POST /api/v1/clientes
     */
    async createClienteController(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            return next(new AppError('User not authenticated', 401));
        }

        const empresaId = req.user.empresaId;
        const userId = req.user.id;

        logger.info(`[ClienteController] Utilizador ${userId} requisitou createCliente para empresa ${empresaId}.`);
        logger.debug(`[ClienteController] Ficheiro recebido (logo): ${req.file ? (req.file as any).key : 'Nenhum'}`);

        try {
            const novoCliente = await this.clienteService.createCliente(req.body, req.file, empresaId);

            // Invalidar cache de clientes após criação
            await cacheService.invalidatePattern(`clientes:empresa:${empresaId}:*`);

            logger.info(`[ClienteController] Cliente ${novoCliente.nome} (ID: ${novoCliente.id}) criado com sucesso por ${userId}.`);
            res.status(201).json(novoCliente);
        } catch (err: unknown) {
            if (err instanceof Error) {
                next(err);
            } else {
                next(new AppError('Unknown error occurred', 500));
            }
        }
    }

    /**
     * Controller para atualizar um cliente existente.
     * PUT /api/v1/clientes/:id
     */
    async updateClienteController(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            return next(new AppError('User not authenticated', 401));
        }

        const empresaId = req.user.empresaId;
        const userId = req.user.id;
        const { id: clienteIdToUpdate } = req.params;

        if (!clienteIdToUpdate) {
            return next(new AppError('Cliente ID is required', 400));
        }

        logger.info(`[ClienteController] Utilizador ${userId} requisitou updateCliente para ID: ${clienteIdToUpdate} na empresa ${empresaId}.`);
        logger.debug(`[ClienteController] Ficheiro recebido (logo): ${req.file ? (req.file as any).key : 'Nenhum/Manter/Remover'}`);

        try {
            const clienteAtualizado = await this.clienteService.updateCliente(clienteIdToUpdate, req.body, req.file, empresaId);

            // Invalidar cache de clientes após atualização
            await cacheService.invalidatePattern(`clientes:empresa:${empresaId}:*`);

            logger.info(`[ClienteController] Cliente ID ${clienteIdToUpdate} atualizado com sucesso por ${userId}.`);
            res.status(200).json(clienteAtualizado);
        } catch (err: unknown) {
            if (err instanceof Error) {
                next(err);
            } else {
                next(new AppError('Unknown error occurred', 500));
            }
        }
    }

    /**
     * Controller para buscar todos os clientes da empresa.
     * GET /api/v1/clientes
     */
    async getAllClientesController(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            return next(new AppError('User not authenticated', 401));
        }

        const empresaId = req.user.empresaId;
        const userId = req.user.id;

        logger.info(`[ClienteController] Utilizador ${userId} requisitou getAllClientes para empresa ${empresaId}.`);

        try {
            const page = req.query.page || 1;
            const limit = req.query.limit || 10;
            const cacheKey = `clientes:empresa:${empresaId}:page:${page}:limit:${limit}`;

            const cachedClientes = await cacheService.get(cacheKey);

            if (cachedClientes) {
                logger.info(`[ClienteController] Cache HIT para getAllClientes empresa ${empresaId} (page ${page}).`);
                res.status(200).json(cachedClientes);
                return;
            }

            logger.info(`[ClienteController] Cache MISS para getAllClientes empresa ${empresaId} (page ${page}). Consultando banco...`);
            const clientesResult = await this.clienteService.getAllClientes(empresaId, req.query);

            await cacheService.set(cacheKey, clientesResult, 180);

            logger.info(`[ClienteController] getAllClientes retornou ${clientesResult.data.length} clientes para empresa ${empresaId}.`);
            res.status(200).json(clientesResult);

        } catch (err: unknown) {
            if (err instanceof Error) {
                next(err);
            } else {
                next(new AppError('Unknown error occurred', 500));
            }
        }
    }

    /**
     * Controller para buscar um cliente específico pelo ID.
     * GET /api/v1/clientes/:id
     */
    async getClienteByIdController(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            return next(new AppError('User not authenticated', 401));
        }

        const empresaId = req.user.empresaId;
        const userId = req.user.id;
        const { id: clienteIdToGet } = req.params;

        if (!clienteIdToGet) {
            return next(new AppError('Cliente ID is required', 400));
        }

        logger.info(`[ClienteController] Utilizador ${userId} requisitou getClienteById para ID: ${clienteIdToGet} na empresa ${empresaId}.`);

        try {
            const cliente = await this.clienteService.getClienteById(clienteIdToGet, empresaId);

            logger.info(`[ClienteController] Cliente ID ${clienteIdToGet} encontrado com sucesso.`);
            res.status(200).json(cliente);
        } catch (err: unknown) {
            if (err instanceof Error) {
                next(err);
            } else {
                next(new AppError('Unknown error occurred', 500));
            }
        }
    }

    /**
     * Controller para apagar um cliente.
     * DELETE /api/v1/clientes/:id
     */
    async deleteClienteController(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
        if (!req.user) {
            return next(new AppError('User not authenticated', 401));
        }

        const empresaId = req.user.empresaId;
        const adminUserId = req.user.id;
        const { id: clienteIdToDelete } = req.params;

        if (!clienteIdToDelete) {
            return next(new AppError('Cliente ID is required', 400));
        }

        logger.info(`[ClienteController] Utilizador ${adminUserId} requisitou deleteCliente para ID: ${clienteIdToDelete} na empresa ${empresaId}.`);

        try {
            await this.clienteService.deleteCliente(clienteIdToDelete, empresaId);

            // Invalidar cache de clientes após exclusão
            await cacheService.invalidatePattern(`clientes:empresa:${empresaId}:*`);

            logger.info(`[ClienteController] Cliente ID ${clienteIdToDelete} apagado com sucesso por ${adminUserId}.`);
            res.status(204).send();
        } catch (err: unknown) {
            if (err instanceof Error) {
                next(err);
            } else {
                next(new AppError('Unknown error occurred', 500));
            }
        }
    }
}

