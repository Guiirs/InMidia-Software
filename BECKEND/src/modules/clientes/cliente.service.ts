// src/services/cliente.service.ts
import Cliente from './Cliente';
import Aluguel from '@modules/alugueis/Aluguel';
import logger from '@shared/container/logger';
import path from 'path';
import { safeDeleteFromR2 } from '@shared/infra/http/middlewares/upload.middleware';
import AppError from '@shared/container/AppError';
import { ICliente } from '../../types/models.d';
import { Document } from 'mongoose';

interface S3File {
    key: string;
    location: string;
    bucket: string;
    mimetype: string;
    originalname: string;
}

interface ClienteData {
    nome: string;
    email?: string;
    telefone?: string;
    cnpj?: string | null;
    responsavel?: string;
    segmento?: string;
    logo_url?: string;
}

interface PaginationParams {
    page?: number;
    limit?: number;
}

interface PaginatedResult {
    data: any[];
    pagination: {
        totalDocs: number;
        totalPages: number;
        currentPage: number;
        limit: number;
    };
}

export class ClienteService {
    async createCliente(clienteData: ClienteData, file: S3File | undefined, empresaId: string): Promise<Document<unknown, {}, ICliente> & ICliente> {
        logger.info(`[ClienteService] Tentando criar cliente para empresa ${empresaId}.`);

        if (!clienteData.nome) {
            throw new AppError('O nome do cliente é obrigatório.', 400);
        }

        const dadosParaSalvar: Partial<ClienteData & { empresaId: string }> = { ...clienteData, empresaId };

        if (file) {
            logger.info(`[ClienteService] Ficheiro recebido (logo): ${file.key}`);
            dadosParaSalvar.logo_url = path.basename(file.key);
        } else {
            delete dadosParaSalvar.logo_url;
        }

        try {
            const novoCliente = new Cliente(dadosParaSalvar);
            await novoCliente.save();

            logger.info(`[ClienteService] Cliente ${novoCliente.nome} criado com sucesso (ID: ${novoCliente._id}).`);
            return novoCliente;
        } catch (error: unknown) {
            if (error instanceof Error) {
                logger.error(`[ClienteService] Erro Mongoose/DB ao criar cliente: ${error.message}`, { stack: error.stack });
                if ((error as any).code === 11000) {
                    throw new AppError('Já existe um cliente com este nome ou CNPJ nesta empresa.', 409);
                }
                throw new AppError(`Erro interno ao criar cliente: ${error.message}`, 500);
            } else {
                throw new AppError('Unknown error occurred', 500);
            }
        }
    }

    async updateCliente(id: string, clienteData: ClienteData, file: S3File | undefined, empresaId: string): Promise<Document<unknown, {}, ICliente> & ICliente> {
        logger.info(`[ClienteService] Tentando atualizar cliente ID ${id} para empresa ${empresaId}.`);

        try {
            const clienteExistente = await Cliente.findOne({ _id: id, empresaId });
            if (!clienteExistente) {
                throw new AppError('Cliente não encontrado.', 404);
            }

            const dadosParaAtualizar: Partial<ClienteData> = { ...clienteData };

            if (file) {
                logger.info(`[ClienteService] Novo ficheiro recebido (logo): ${file.key}`);
                dadosParaAtualizar.logo_url = path.basename(file.key);

                // Apagar imagem antiga se existir
                if ((clienteExistente as any).logo_url) {
                    const imagemAntigaKey = `clientes/${(clienteExistente as any).logo_url}`;
                    try {
                        await safeDeleteFromR2(imagemAntigaKey);
                        logger.info(`[ClienteService] Imagem antiga apagada: ${imagemAntigaKey}`);
                    } catch (deleteError: unknown) {
                        logger.warn(`[ClienteService] Falha ao apagar imagem antiga: ${imagemAntigaKey}`, { error: deleteError });
                    }
                }
            } else if (clienteData.logo_url === null) {
                // Remover logo
                if ((clienteExistente as any).logo_url) {
                    const imagemKey = `clientes/${(clienteExistente as any).logo_url}`;
                    try {
                        await safeDeleteFromR2(imagemKey);
                        logger.info(`[ClienteService] Logo removido: ${imagemKey}`);
                    } catch (deleteError: unknown) {
                        logger.warn(`[ClienteService] Falha ao remover logo: ${imagemKey}`, { error: deleteError });
                    }
                }
                dadosParaAtualizar.logo_url = undefined;
            }

            const clienteAtualizado = await Cliente.findOneAndUpdate(
                { _id: id, empresaId },
                dadosParaAtualizar,
                { new: true, runValidators: true }
            );

            if (!clienteAtualizado) {
                throw new AppError('Cliente não encontrado após atualização.', 404);
            }

            logger.info(`[ClienteService] Cliente ID ${id} atualizado com sucesso.`);
            return clienteAtualizado;
        } catch (error: unknown) {
            if (error instanceof Error) {
                logger.error(`[ClienteService] Erro Mongoose/DB ao atualizar cliente ID ${id}: ${error.message}`, { stack: error.stack });
                if ((error as any).code === 11000) {
                    throw new AppError('Já existe um cliente com este nome ou CNPJ nesta empresa.', 409);
                }
                throw new AppError(`Erro interno ao atualizar cliente: ${error.message}`, 500);
            } else {
                throw new AppError('Unknown error occurred', 500);
            }
        }
    }

    async getAllClientes(empresaId: string, queryParams: PaginationParams): Promise<PaginatedResult> {
        logger.info(`[ClienteService] Buscando todos os clientes para empresa ${empresaId}.`);

        const page = Math.max(1, parseInt(String(queryParams.page), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(queryParams.limit), 10) || 10));
        const skip = (page - 1) * limit;

        try {
            const totalDocs = await Cliente.countDocuments({ empresaId });
            const clientes = await Cliente.find({ empresaId })
                .sort({ nome: 1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const totalPages = Math.ceil(totalDocs / limit);

            const result: PaginatedResult = {
                data: clientes,
                pagination: {
                    totalDocs,
                    totalPages,
                    currentPage: page,
                    limit
                }
            };

            logger.info(`[ClienteService] Encontrados ${clientes.length} clientes (página ${page} de ${totalPages}).`);
            return result;
        } catch (error: unknown) {
            if (error instanceof Error) {
                logger.error(`[ClienteService] Erro Mongoose/DB ao buscar clientes: ${error.message}`, { stack: error.stack });
                throw new AppError(`Erro interno ao buscar clientes: ${error.message}`, 500);
            } else {
                throw new AppError('Unknown error occurred', 500);
            }
        }
    }

    async getClienteById(id: string, empresaId: string): Promise<any> {
        logger.info(`[ClienteService] Buscando cliente ID ${id} para empresa ${empresaId}.`);

        try {
            const cliente = await Cliente.findOne({ _id: id, empresaId }).lean();
            if (!cliente) {
                throw new AppError('Cliente não encontrado.', 404);
            }

            logger.info(`[ClienteService] Cliente ID ${id} encontrado.`);
            return cliente;
        } catch (error: unknown) {
            if (error instanceof Error) {
                logger.error(`[ClienteService] Erro Mongoose/DB ao buscar cliente por ID ${id}: ${error.message}`, { stack: error.stack });
                throw new AppError(`Erro interno ao buscar cliente: ${error.message}`, 500);
            } else {
                throw new AppError('Unknown error occurred', 500);
            }
        }
    }

    async deleteCliente(id: string, empresaId: string): Promise<void> {
        logger.info(`[ClienteService] Tentando apagar cliente ID ${id} para empresa ${empresaId}.`);

        try {
            const clienteExistente = await Cliente.findOne({ _id: id, empresaId });
            if (!clienteExistente) {
                throw new AppError('Cliente não encontrado.', 404);
            }

            // Verificar se o cliente tem aluguéis ativos
            const alugueisAtivos = await Aluguel.countDocuments({
                clienteId: id,
                empresaId,
                status: { $in: ['ativo', 'futuro'] }
            });

            if (alugueisAtivos > 0) {
                throw new AppError('Não é possível apagar um cliente com aluguéis ativos ou futuros.', 409);
            }

            // Verificar se o cliente tem PIs
            const PropostaInterna = (await import('@modules/propostas-internas/PropostaInterna')).default;
            const pisCount = await PropostaInterna.countDocuments({
                clienteId: id,
                empresaId
            });

            if (pisCount > 0) {
                throw new AppError('Não é possível apagar um cliente com Propostas Internas associadas.', 409);
            }

            // Verificar se o cliente tem Contratos
            const Contrato = (await import('@modules/contratos/Contrato')).default;
            const contratosCount = await Contrato.countDocuments({
                clienteId: id,
                empresaId
            });

            if (contratosCount > 0) {
                throw new AppError('Não é possível apagar um cliente com Contratos associados.', 409);
            }

            // Apagar logo se existir
            if ((clienteExistente as any).logo_url) {
                const imagemKey = `clientes/${(clienteExistente as any).logo_url}`;
                try {
                    await safeDeleteFromR2(imagemKey);
                    logger.info(`[ClienteService] Logo do cliente apagado: ${imagemKey}`);
                } catch (deleteError: unknown) {
                    logger.warn(`[ClienteService] Falha ao apagar logo do cliente: ${imagemKey}`, { error: deleteError });
                }
            }

            await Cliente.deleteOne({ _id: id, empresaId });

            logger.info(`[ClienteService] Cliente ID ${id} apagado com sucesso.`);
        } catch (error: unknown) {
            if (error instanceof Error) {
                logger.error(`[ClienteService] Erro Mongoose/DB ao apagar cliente ID ${id}: ${error.message}`, { stack: error.stack });
                throw new AppError(`Erro interno ao apagar cliente: ${error.message}`, 500);
            } else {
                throw new AppError('Unknown error occurred', 500);
            }
        }
    }
}



