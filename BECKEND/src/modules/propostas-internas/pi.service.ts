/**
 * PI Service
 * Lógica de propostas internas
 */
// src/modules/propostas-internas/pi.service.ts
import PropostaInterna from './PropostaInterna';
import Cliente from '../clientes/Cliente';
import User from '../users/User';
import Empresa from '../empresas/Empresa';
import Aluguel from '../alugueis/Aluguel';
import AppError from '../../shared/container/AppError';
import logger from '../../shared/container/logger';
import pdfService from '../../shared/container/pdf.service';
import PeriodService from '../../shared/container/period.service';
import XlsxPopulate from 'xlsx-populate';
import path from 'path';
import fs from 'fs/promises';
import { convertXlsxBufferToPdf } from '../../shared/utils/xlsx-to-pdf.converter';
import type { Response } from 'express';
import type { NormalizedPeriod, PeriodInput } from '../../shared/services/period/period.types';
import type { Types } from 'mongoose';
import { temporalEngine } from '@modules/temporal';
import Contrato from '../contratos/Contrato';
import Placa from '../placas/Placa';

// ─── Tipos para documentos populados ──────────────────────────────────────────

/**
 * Campos do cliente após populate em PI.
 * Inclui campos canônicos do schema e campos opcionais de documentos legados.
 */
interface PopulatedClienteOnPI {
  _id: Types.ObjectId | string;
  nome: string;
  cpfCnpj?: string;          // campo canônico do schema (era 'cnpj' em código legado)
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  // Campos opcionais presentes em documentos mais antigos (não no schema atual)
  bairro?: string;
  responsavel?: string;
  segmento?: string;
}

/**
 * Campos de placa após populate em PI.
 */
interface PopulatedPlacaOnPI {
  _id: Types.ObjectId | string;
  numero_placa: string;
  codigo?: string;
  nomeDaRua?: string;
  localizacao?: string;
  tamanho?: string;
  regiao?: { _id: Types.ObjectId | string; nome: string };
}

/**
 * PI com clienteId e placas populados (resultado de getById).
 */
interface PopulatedPI {
  _id: Types.ObjectId;
  clienteId: PopulatedClienteOnPI;
  placas: PopulatedPlacaOnPI[];
  valorTotal: number;
  valorProducao?: number;
  descricao: string;
  formaPagamento?: string;
  status: string;
  periodType?: string;
  startDate?: Date;
  endDate?: Date;
  dataInicio?: Date;
  dataFim?: Date;
  tipoPeriodo?: string;
  descricaoPeriodo?: string;
  produto?: string;
  pi_code?: string;
  [key: string]: unknown;   // índice para campos dinâmicos do schema
}

class PIService {

    /**
     * Gera um código único para sincronização PI ↔ Aluguéis
     */
    _generatePICode() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `PI-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * Cria aluguéis automaticamente para as placas da PI
     * [PERÍODO UNIFICADO] Recebe objeto period completo
     */
    async _criarAlugueisParaPI(piId: unknown, piCode: string, clienteId: unknown, placaIds: unknown[], period: NormalizedPeriod, empresaId: string) {
        if (!placaIds || placaIds.length === 0) {
            logger.debug(`[PIService] Nenhuma placa para criar aluguéis`);
            return;
        }

        // Garante que clienteId é um ObjectId, não um objeto populado.
        // Quando populado, o objeto tem _id; quando não, é já um ObjectId.
        const clienteIdFinal = (
            typeof clienteId === 'object' && clienteId !== null && '_id' in clienteId
                ? (clienteId as { _id: unknown })._id
                : clienteId
        );

        logger.info(`[PIService] Criando ${placaIds.length} aluguéis para PI ${piId} (Code: ${piCode})`);
        logger.debug(`[PIService] clienteId recebido: ${clienteId}, clienteIdFinal: ${clienteIdFinal}`);

        const alugueis = placaIds.map((placaId, index) => {
            const aluguel = {
                placaId: placaId,
                clienteId: clienteIdFinal,
                empresaId: empresaId,
                // [PERÍODO UNIFICADO] Novos campos
                periodType: period.periodType,
                startDate: period.startDate,
                endDate: period.endDate,
                biWeekIds: period.biWeekIds || [],
                biWeeks: period.biWeeks ? period.biWeeks.map(bw => bw._id) : [],
                // [LEGADO] Mantido para compatibilidade
                data_inicio: period.startDate,
                data_fim: period.endDate,
                bi_week_ids: period.biWeekIds || [],
                bi_weeks: period.biWeeks ? period.biWeeks.map(bw => bw._id) : [],
                // PI sync
                pi_code: piCode,
                proposta_interna: piId,
                tipo: 'pi'
            };
            logger.debug(`[PIService] Aluguel ${index + 1}/${placaIds.length}: ${JSON.stringify(aluguel)}`);
            return aluguel;
        });

        try {
            const alugueisCreated = await Aluguel.insertMany(alugueis);
            logger.info(`[PIService] ${alugueisCreated.length} aluguéis criados com sucesso para PI ${piId}`);
            
            // NOTA: Não modificamos o campo 'disponivel' das placas aqui
            // A disponibilidade é gerenciada pela verificação de conflitos de datas
            // O campo 'disponivel: false' é reservado para manutenção manual
            
            return alugueisCreated;
        } catch (error: any) {
            logger.error(`[PIService] Erro ao criar aluguéis para PI ${piId}: ${error.message}`);
            throw new AppError(`Erro ao criar aluguéis: ${error.message}`, 500);
        }
    }

    /**
     * Valida se o cliente pertence à empresa
     */
    async _validateCliente(clienteId: unknown, empresaId: string) {
        const cliente = await Cliente.findOne({ _id: clienteId, empresaId: empresaId }).lean();
        if (!cliente) {
            throw new AppError('Cliente não encontrado ou não pertence à sua empresa.', 404);
        }
        return cliente;
    }

    /**
     * Cria uma nova PI
     * [PERÍODO UNIFICADO] Processa período usando PeriodService
     */
    async create(piData: Record<string, unknown>, empresaId: string) {
        logger.info(`[PIService] Criando PI para empresa ${empresaId}`);
        logger.debug(`[PIService] piData recebido: ${JSON.stringify(piData, null, 2)}`);
        logger.debug(`[PIService] Placas recebidas: ${(piData.placas as unknown[] | undefined)?.length || 0} placas - ${JSON.stringify(piData.placas)}`);
        
        // Valida o cliente antes de criar.
        // Note que piData.cliente é o ID.
        await this._validateCliente(piData.cliente, empresaId);

        // [PERÍODO UNIFICADO] Processar período usando PeriodService
        let period;
        try {
            logger.debug('[PIService] Processando período com PeriodService...');
            
            // Extrair apenas os campos de período do piData
            const periodInput = {
                periodType: piData.periodType,
                tipoPeriodo: piData.tipoPeriodo,
                startDate: piData.startDate,
                endDate: piData.endDate,
                dataInicio: piData.dataInicio,
                dataFim: piData.dataFim,
                data_inicio: piData.data_inicio,
                data_fim: piData.data_fim,
                biWeekIds: piData.biWeekIds,
                bi_week_ids: piData.bi_week_ids,
                biWeeks: piData.biWeeks,
                bi_weeks: piData.bi_weeks
            };
            
            logger.debug(`[PIService] periodInput extraído:`, periodInput);
            // Cast como PeriodInput — piData é Record<string,unknown> mas os campos extraídos
            // correspondem exatamente ao shape de PeriodInput (compatibilidade validada em runtime).
            period = await PeriodService.processPeriodInput(periodInput as PeriodInput);
            
            logger.info(`[PIService] Período processado: Tipo=${period.periodType}`);
            logger.info(`[PIService] Datas: ${PeriodService.formatDate(period.startDate)} - ${PeriodService.formatDate(period.endDate)}`);
            if (period.biWeekIds && period.biWeekIds.length > 0) {
                logger.info(`[PIService] Bi-semanas: ${period.biWeekIds.join(', ')}`);
            }
        } catch (periodError: any) {
            logger.error(`[PIService] Erro ao processar período: ${periodError.message}`);
            throw periodError; // PeriodService já lança AppError
        }

        // Gera código único de sincronização
        const piCode = this._generatePICode();
        logger.info(`[PIService] Código de sincronização gerado: ${piCode}`);

        const placasSelecionadas = ((piData.placas as unknown[] | undefined) || []).map((placaId) => String(placaId));
        if (placasSelecionadas.length > 0) {
            await temporalEngine.assertMultiplePlatesAvailable(
                placasSelecionadas,
                period.startDate as Date,
                period.endDate as Date,
                { empresaId }
            );
        }

        const novaPI = new PropostaInterna({
            ...piData,
            empresaId: empresaId,
            pi_code: piCode,
            status: (piData.status as string) || 'DRAFT', // Default DRAFT; aceita override explícito
            // [PERÍODO UNIFICADO] Novos campos
            periodType: period.periodType,
            startDate: period.startDate,
            endDate: period.endDate,
            biWeekIds: period.biWeekIds,
            biWeeks: period.biWeeks ? period.biWeeks.map(bw => bw._id) : [],
            // [LEGADO] Mantido para compatibilidade
            dataInicio: period.startDate,
            dataFim: period.endDate,
            tipoPeriodo: period.periodType === 'bi-week' ? 'quinzenal' : 'customizado'
        });

        logger.debug(`[PIService] Documento PI antes de salvar: ${JSON.stringify(novaPI.toObject(), null, 2)}`);

        try {
            await novaPI.save();
            
            logger.info(`[PIService] PI salva com sucesso. ID: ${novaPI._id}, Code: ${piCode}, Placas no documento: ${novaPI.placas?.length || 0}`);
            logger.debug(`[PIService] Verificando se deve criar aluguéis...`);
            logger.debug(`[PIService] novaPI.placas: ${JSON.stringify(novaPI.placas)}`);
            logger.debug(`[PIService] novaPI.clienteId: ${novaPI.clienteId}`);
            logger.debug(`[PIService] period: ${JSON.stringify(period)}`);
            
            // Criar aluguéis automaticamente para as placas
            if (novaPI.placas && novaPI.placas.length > 0) {
                logger.info(`[PIService] ✅ Condição atendida: Criando aluguéis para ${novaPI.placas.length} placas`);
                await temporalEngine.replaceSourceReservations({
                    empresaId,
                    sourceType: 'PI',
                    sourceId: String(novaPI._id),
                    plateIds: novaPI.placas.map((placaId: unknown) => String(placaId)),
                    customerId: String(novaPI.clienteId),
                    startDate: period.startDate as Date,
                    endDate: period.endDate as Date,
                    status: 'RESERVED',
                    reason: `Reserva gerada pela PI ${piCode}`,
                });
                await this._criarAlugueisParaPI(
                    novaPI._id,
                    piCode,
                    novaPI.clienteId, // Usar clienteId do documento salvo
                    novaPI.placas,
                    period, // [PERÍODO UNIFICADO] Passa objeto period completo
                    empresaId
                );
            } else {
                logger.warn(`[PIService] ⚠️ Nenhuma placa para criar aluguéis! Placas: ${novaPI.placas?.length || 0}`);
            }
            
            await novaPI.populate([
                { path: 'clienteId', select: 'nome email telefone cpfCnpj responsavel segmento' },
                { path: 'placas', select: 'numero_placa nomeDaRua' } // Popula placas no retorno
            ]);
            return novaPI.toJSON();
        } catch (error: any) {
            logger.error(`[PIService] Erro ao criar PI: ${error.message}`, { stack: error.stack });
            throw new AppError(`Erro interno ao criar proposta: ${error.message}`, 500);
        }
    }

    /**
     * Busca uma PI pelo ID (Usado para o PDF)
     */
    async getById(piId: string, empresaId: string): Promise<PopulatedPI> {
        const pi = await PropostaInterna.findOne({ _id: piId, empresaId: empresaId })
            .populate('clienteId')
            .populate({
                path: 'placas',
                select: 'numero_placa codigo tipo regiao nomeDaRua tamanho',
                populate: { path: 'regiao', select: 'nome' }
            })
            .lean();

        if (!pi) {
            throw new AppError('Proposta Interna (PI) não encontrada.', 404);
        }
        // O lean doc com populate corresponde a PopulatedPI — cast é seguro pois
        // o populate garante que clienteId e placas são objetos, não ObjectId.
        return pi as unknown as PopulatedPI;
    }

    /**
     * Lista todas as PIs (Usado pela tabela principal)
     */
    async getAll(empresaId: string, queryParams: Record<string, unknown>) {
        const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', status, clienteId } = queryParams;

        const pageInt = parseInt(String(page), 10);
        const limitInt = parseInt(String(limit), 10);
        const skip = (pageInt - 1) * limitInt;
        const sortOrder = order === 'desc' ? -1 : 1;

        // Whitelist para campos de ordenação.
        const camposOrdenaveis = ['createdAt', 'updatedAt', 'dataInicio', 'dataFim', 'valorTotal', 'status'];
        const campoOrdenacaoFinal = camposOrdenaveis.includes(String(sortBy)) ? String(sortBy) : 'createdAt';

        const query: Record<string, unknown> = { empresaId };
        if (status) query.status = status;
        if (clienteId) query.clienteId = clienteId;
        
        try {
            const [pis, totalDocs] = await Promise.all([
                PropostaInterna.find(query)
                    // Selecionamos os campos novos para que o "Editar" funcione
                    .select('clienteId tipoPeriodo dataInicio dataFim valorTotal status formaPagamento placas descricao periodType startDate endDate biWeekIds') // Campos unificados
                    .populate({
                        path: 'clienteId',
                        select: 'nome responsavel segmento' // Dados para o auto-fill do modal
                    })
                    .populate({
                        path: 'cliente', // Virtual field para compatibilidade com frontend
                        select: 'nome responsavel segmento'
                    })
                    .sort({ [campoOrdenacaoFinal as string]: sortOrder })
                    .skip(skip)
                    .limit(limitInt)
                    .lean(),
                PropostaInterna.countDocuments(query)
            ]);

            const totalPages = Math.ceil(totalDocs / limitInt);
            const pagination = { totalDocs, totalPages, currentPage: pageInt, limit: limitInt };

            return { data: pis, pagination };
        } catch (error: any) {
            logger.error(`[PIService] Erro ao listar PIs: ${error.message}`, { stack: error.stack });
            throw new AppError(`Erro interno ao listar propostas: ${error.message}`, 500);
        }
    }

    /**
     * Atualiza uma PI
     * [PERÍODO UNIFICADO] Processa período se fornecido
     */
    async update(piId: string, updateData: Record<string, unknown>, empresaId: string) {
        if (updateData.cliente) {
            await this._validateCliente(updateData.cliente, empresaId);
        }

        // Busca a PI atual para comparar as placas
        const piAtual = await PropostaInterna.findOne({ _id: piId, empresaId: empresaId }).lean();
        if (!piAtual) {
            throw new AppError('PI não encontrada.', 404);
        }

        const placasAntigas = (piAtual.placas || []).map((p: unknown) => String(p));
        const placasNovas = updateData.placas
            ? ((updateData.placas as unknown[] | undefined) || []).map((p: unknown) => String(p))
            : placasAntigas;

        // [PERÍODO UNIFICADO] Processar período se fornecido
        let period = null;
        const hasPeriodUpdate = updateData.periodType || updateData.startDate || updateData.endDate || 
                                updateData.biWeekIds || updateData.dataInicio || updateData.dataFim;
        
        if (hasPeriodUpdate) {
            try {
                logger.debug('[PIService] Processando novo período com PeriodService...');
                period = await PeriodService.processPeriodInput(updateData as PeriodInput);
                
                logger.info(`[PIService] Novo período processado: Tipo=${period.periodType}`);
                logger.info(`[PIService] Datas: ${PeriodService.formatDate(period.startDate)} - ${PeriodService.formatDate(period.endDate)}`);
            } catch (periodError: any) {
                logger.error(`[PIService] Erro ao processar período: ${periodError.message}`);
                throw periodError;
            }
        }

        // <-- CORREÇÃO CRÍTICA DE SEGURANÇA (MASS ASSIGNMENT) -->
        // Desestruture explicitamente APENAS os campos que podem ser atualizados.
        const periodoParaValidacao = {
            startDate: period?.startDate || (piAtual as any).startDate || (piAtual as any).dataInicio,
            endDate: period?.endDate || (piAtual as any).endDate || (piAtual as any).dataFim,
        };
        if (placasNovas.length > 0 && (updateData.placas || period)) {
            await temporalEngine.assertMultiplePlatesAvailable(
                placasNovas,
                periodoParaValidacao.startDate,
                periodoParaValidacao.endDate,
                {
                    empresaId,
                    sourceType: 'PI',
                    sourceId: piId,
                }
            );
        }

        const {
            cliente,
            tipoPeriodo: _tipoPeriodo,
            dataInicio: _dataInicio,
            dataFim: _dataFim,
            valorTotal,
            descricao,
            placas,
            formaPagamento
            // Note que 'status' e 'empresa' não estão aqui de propósito.
        } = updateData;

        // Record<string, unknown> permite adicionar campos de período sem erros de tipo.
        const dadosParaAtualizar: Record<string, unknown> = {
            cliente,
            valorTotal,
            descricao,
            placas,
            formaPagamento
        };

        // [PERÍODO UNIFICADO] Adiciona campos de período se processado
        if (period) {
            dadosParaAtualizar.periodType = period.periodType;
            dadosParaAtualizar.startDate = period.startDate;
            dadosParaAtualizar.endDate = period.endDate;
            dadosParaAtualizar.biWeekIds = period.biWeekIds;
            dadosParaAtualizar.biWeeks = period.biWeeks ? period.biWeeks.map(bw => bw._id) : [];
            // [LEGADO] Compatibilidade
            dadosParaAtualizar.dataInicio = period.startDate;
            dadosParaAtualizar.dataFim = period.endDate;
            dadosParaAtualizar.tipoPeriodo = period.periodType === 'bi-week' ? 'quinzenal' : 'customizado';
        }

        // Remove quaisquer chaves 'undefined'
        Object.keys(dadosParaAtualizar).forEach(key => {
            if (dadosParaAtualizar[key] === undefined) delete dadosParaAtualizar[key];
        });
        // <-- FIM DA CORREÇÃO DE SEGURANÇA -->

        try {
            const piAtualizada = await PropostaInterna.findOneAndUpdate(
                { _id: piId, empresaId: empresaId },
                { $set: dadosParaAtualizar }, // <-- SEGURO
                { new: true, runValidators: true }
            )
            .populate([
                { path: 'cliente', select: 'nome email telefone cpfCnpj responsavel segmento' },
                { path: 'placas', select: 'numero_placa nomeDaRua' } // Popula placas no retorno
            ]);

            if (!piAtualizada) {
                throw new AppError('PI não encontrada.', 404);
            }

            // Extrai o ID do cliente (clienteId pode vir populado do banco após populate)
            // clienteId pode ser ObjectId (não populado) ou objeto ICliente (após populate)
            const clienteIdRef = piAtualizada.clienteId;
            const clienteId = (
                typeof clienteIdRef === 'object' && clienteIdRef !== null && '_id' in clienteIdRef
                    ? (clienteIdRef as { _id: unknown })._id
                    : clienteIdRef
            );

            // Gerenciar aluguéis quando as placas mudam
            if (updateData.placas) {
                const placasRemovidas = placasAntigas.filter(p => !placasNovas.includes(p));
                const placasAdicionadas = placasNovas.filter(p => !placasAntigas.includes(p));

                logger.debug(`[PIService] Update PI: ${placasRemovidas.length} placas removidas, ${placasAdicionadas.length} placas adicionadas`);

                // Remove aluguéis das placas removidas usando pi_code para garantir consistência
                if (placasRemovidas.length > 0) {
                    const deleted = await Aluguel.deleteMany({
                        pi_code: piAtualizada.pi_code,
                        empresaId,
                        placa: { $in: placasRemovidas }
                    });
                    logger.info(`[PIService] ${deleted.deletedCount} aluguéis removidos (pi_code: ${piAtualizada.pi_code})`);
                }

                // Cria aluguéis para placas adicionadas
                if (placasAdicionadas.length > 0) {
                    // [PERÍODO UNIFICADO] Usa período da PI atualizada
                    // periodType é PeriodType (enum) — cast as any para compatibilidade com NormalizedPeriod
                    const periodParaAlugueis = {
                        periodType: (piAtualizada.periodType || 'custom') as any,
                        startDate: piAtualizada.startDate || piAtualizada.dataInicio,
                        endDate: piAtualizada.endDate || piAtualizada.dataFim,
                        biWeekIds: piAtualizada.biWeekIds || [],
                        biWeeks: (piAtualizada.biWeeks || []) as any[]
                    } as NormalizedPeriod;
                    
                    await this._criarAlugueisParaPI(
                        piId,
                        piAtualizada.pi_code,
                        clienteId,
                        placasAdicionadas,
                        periodParaAlugueis, // [PERÍODO UNIFICADO] Passa objeto period
                        empresaId
                    );
                }
            }

            // [PERÍODO UNIFICADO] Se as datas mudaram, atualiza todos os aluguéis usando pi_code
            if (period) {
                const updated = await Aluguel.updateMany(
                    {
                        pi_code: piAtualizada.pi_code,
                        empresaId
                    },
                    {
                        $set: {
                            // Novos campos
                            periodType: period.periodType,
                            startDate: period.startDate,
                            endDate: period.endDate,
                            biWeekIds: period.biWeekIds,
                            biWeeks: period.biWeeks ? period.biWeeks.map(bw => bw._id) : [],
                            // Legado
                            data_inicio: period.startDate,
                            data_fim: period.endDate,
                            bi_week_ids: period.biWeekIds,
                            bi_weeks: period.biWeeks ? period.biWeeks.map(bw => bw._id) : []
                        }
                    }
                );
                logger.info(`[PIService] ${updated.modifiedCount} aluguéis atualizados para PI ${piId} (pi_code: ${piAtualizada.pi_code})`);
            }

            if (updateData.placas || period) {
                await temporalEngine.replaceSourceReservations({
                    empresaId,
                    sourceType: 'PI',
                    sourceId: piId,
                    plateIds: (piAtualizada.placas || []).map((placaId: unknown) => String(placaId)),
                    customerId: String(clienteId),
                    startDate: piAtualizada.startDate || piAtualizada.dataInicio,
                    endDate: piAtualizada.endDate || piAtualizada.dataFim,
                    status: 'RESERVED',
                    reason: `Reserva atualizada pela PI ${piAtualizada.pi_code}`,
                });
            }

            return piAtualizada.toJSON();
        } catch (error: any) {
            logger.error(`[PIService] Erro ao atualizar PI ${piId}: ${error.message}`, { stack: error.stack });
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao atualizar proposta: ${error.message}`, 500);
        }
    }

    /**
     * Deleta uma PI
     */
    async delete(piId: string, empresaId: string) {
        try {
            // Busca a PI antes de deletar para pegar as placas
            const pi = await PropostaInterna.findOne({ _id: piId, empresaId: empresaId }).lean();
            
            if (!pi) {
                throw new AppError('PI não encontrada.', 404);
            }

            // Adicionar verificação se a PI está vinculada a um contrato?
            // const contrato = await Contrato.findOne({ pi: piId, empresa: empresaId });
            // if (contrato) {
            //    throw new AppError('Não é possível apagar uma PI que já gerou um contrato.', 400);
            // }
            
            const result = await PropostaInterna.deleteOne({ _id: piId, empresaId: empresaId });
            
            if (result.deletedCount === 0) {
                throw new AppError('PI não encontrada.', 404);
            }

            // Remove todos os aluguéis associados a esta PI usando pi_code para garantir consistência
            const alugueisRemovidos = await Aluguel.deleteMany({
                pi_code: pi.pi_code,
                empresaId
            });
            logger.info(`[PIService] PI ${piId} deletada. ${alugueisRemovidos.deletedCount} aluguéis removidos (pi_code: ${pi.pi_code})`);
            
            // NOTA: Não modificamos o campo 'disponivel' das placas ao deletar
            // O campo 'disponivel' é apenas para manutenção manual
            // A disponibilidade real é calculada pela verificação de conflitos de datas
            
            await temporalEngine.cancelTemporalReservation('PI', piId, empresaId);
        } catch (error: any) {
            logger.error(`[PIService] Erro ao deletar PI ${piId}: ${error.message}`, { stack: error.stack });
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao deletar proposta: ${error.message}`, 500);
        }
    }

    /**
     * Gera e envia o PDF da PI
     */
    async generatePDF(piId: string, empresaId: string, userId: string, res: Response) {
        logger.debug(`[PIService] Gerando PDF para PI ${piId}. Buscando dados...`);
        try {
            // 1. Buscar todos os dados necessários
            const pi = await this.getById(piId, empresaId); 
            
            // getById retorna PopulatedPI — clienteId e placas são objetos populados
            logger.debug(`[PIService] PI encontrada: ${pi._id}`);
            logger.debug(`[PIService] Cliente ID: ${pi.clienteId?._id || 'undefined'}`);
            logger.debug(`[PIService] Cliente nome: ${pi.clienteId?.nome || 'undefined'}`);

            const [empresa, user] = await Promise.all([
                Empresa.findById(empresaId).select('nome cnpj endereco telefone').lean(),
                User.findById(userId).lean()
            ]);

            if (!empresa) {
                throw new AppError('Empresa não encontrada.', 404);
            }

            if (!user) {
                throw new AppError('Usuário não encontrado.', 404);
            }

            if (!pi.clienteId) {
                throw new AppError('Cliente da PI não encontrado.', 404);
            }

            logger.debug(`[PIService] Empresa: ${empresa.nome}`);
            logger.debug(`[PIService] Usuário: ${user.nome}`);
            logger.debug(`[PIService] Chamando pdfService.generatePI_PDF...`);

            // 2. Chamar o serviço de PDF (pi.clienteId já populado pelo getById)
            pdfService.generatePI_PDF(res, pi, pi.clienteId, empresa, user);

        } catch (error: any) {
            logger.error(`[PIService] Erro ao gerar PDF da PI ${piId}: ${error.message}`, { stack: error.stack });
            // Se o erro ocorrer antes do streaming, o errorHandler global pega
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao gerar PDF: ${error.message}`, 500);
        }
    }

    /**
     * Gera Excel da PI com dados preenchidos
     */
    async generateExcel(piId: string, empresaId: string, res: Response) {
        logger.debug(`[PIService] Gerando Excel para PI ${piId}...`);
        try {
            // 1. Buscar PI com dados completos
            const pi = await this.getById(piId, empresaId);

            if (!pi) {
                throw new AppError('PI não encontrada.', 404);
            }

            // getById retorna PopulatedPI — sem cast necessário
            const empresa = await Empresa.findById(empresaId)
                .select('nome cnpj endereco telefone')
                .lean();

            if (!empresa) {
                throw new AppError('Empresa não encontrada.', 404);
            }

            // 3. Preparar dados para o Excel
            const piData = {
                cliente: {
                    nome: pi.clienteId?.nome || 'N/A',
                    // Campo canônico do schema é cpfCnpj (não cnpj)
                    cnpj: pi.clienteId?.cpfCnpj || 'N/A',
                    endereco: `${pi.clienteId?.endereco || ''}, ${pi.clienteId?.cidade || ''}`.trim(),
                    telefone: pi.clienteId?.telefone || 'N/A',
                    responsavel: pi.clienteId?.responsavel || 'N/A',
                    segmento: pi.clienteId?.segmento || 'N/A'
                },
                empresa: {
                    nome: empresa.nome || 'N/A',
                    cnpj: empresa.cnpj || 'N/A',
                    endereco: (empresa.endereco || '').trim(),
                    telefone: empresa.telefone || 'N/A'
                },
                pi: {
                    numero: pi._id.toString(),
                    produto: pi.produto || 'OUTDOOR',
                    descricao: pi.descricao || 'N/A',
                    periodo: pi.descricaoPeriodo || pi.tipoPeriodo || 'MENSAL',
                    dataInicio: pi.dataInicio ? new Date(pi.dataInicio).toLocaleDateString('pt-BR') : 'N/A',
                    dataFim: pi.dataFim ? new Date(pi.dataFim).toLocaleDateString('pt-BR') : 'N/A',
                    formaPagamento: pi.formaPagamento || 'A combinar',
                    valorProducao: pi.valorProducao || 0,
                    valorTotal: pi.valorTotal || 0
                },
                placas: (pi.placas || []).map((placa) => ({
                    numero: placa.numero_placa || placa.codigo || 'N/A',
                    localizacao: `${placa.nomeDaRua || ''} - ${placa.regiao?.nome || ''}`.trim(),
                    tamanho: placa.tamanho || 'N/A'
                }))
            };

            // 4. Carrega o template Excel
            const templatePath = path.join(process.cwd(), '..', 'templates', 'PI.xlsx');
            
            logger.debug(`[PIService] Tentando carregar template de: ${templatePath}`);
            
            try {
                await fs.access(templatePath);
                logger.debug(`[PIService] Template encontrado`);
            } catch (err: any) {
                logger.error(`[PIService] Template não encontrado em: ${templatePath}`);
                throw new AppError('Template Excel não encontrado.', 500);
            }

            const workbook = await XlsxPopulate.fromFileAsync(templatePath);
            const sheet = workbook.sheet(0);
            
            logger.debug(`[PIService] Template carregado, preenchendo dados...`);

            // 5. Preenche os dados (simplificado, sem try/catch individual)
            sheet.cell('B3').value(piData.empresa.nome);
            sheet.cell('D3').value(piData.cliente.nome);
            sheet.cell('F3').value(piData.pi.produto);
            sheet.cell('H3').value(piData.pi.numero);
            
            sheet.cell('B5').value(piData.empresa.endereco);
            sheet.cell('D5').value(piData.cliente.endereco);
            sheet.cell('F5').value(new Date().toLocaleDateString('pt-BR'));
            sheet.cell('H5').value(piData.pi.periodo);
            
            sheet.cell('B7').value(`${piData.empresa.cnpj}\n${piData.empresa.telefone}`);
            sheet.cell('D7').value(`${piData.cliente.cnpj}\n${piData.cliente.telefone}`);
            sheet.cell('F7').value(piData.cliente.responsavel);
            sheet.cell('H7').value(piData.cliente.segmento);
            
            sheet.cell('B9').value('Atendimento');
            sheet.cell('D9').value(piData.pi.formaPagamento);
            sheet.cell('F9').value(piData.pi.dataInicio);
            sheet.cell('H9').value(piData.pi.dataFim);
            
            sheet.cell('B11').value(piData.pi.descricao);
            
            // Valores financeiros
            const valorVeiculacao = piData.pi.valorTotal - piData.pi.valorProducao;
            sheet.cell('F18').value(piData.pi.valorProducao);
            sheet.cell('F19').value(valorVeiculacao);
            sheet.cell('F20').value(piData.pi.valorTotal);

            // Placas
            if (piData.placas.length > 0) {
                const descricaoPlacas = piData.placas
                    .map((placa: { numero: string; localizacao: string; tamanho: string }, idx: number) => `${idx + 1}. PLACA ${placa.numero} - ${placa.localizacao} (${placa.tamanho})`)
                    .join('\n');
                sheet.cell('B13').value(`PLACAS:\n${descricaoPlacas}`);
            }

            // 6. Gera o buffer
            const buffer = await workbook.outputAsync();

            // 7. Headers e envio
            const filename = `PI_${piId}_${piData.cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', buffer.length);

            res.send(buffer);
            logger.info(`[PIService] Excel ${filename} gerado com sucesso`);

        } catch (error: any) {
            logger.error(`[PIService] Erro ao gerar Excel da PI ${piId}: ${error.message}`, { stack: error.stack });
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao gerar Excel: ${error.message}`, 500);
        }
    }

    /**
     * Gera PDF da PI a partir do Excel (XLSX convertido para PDF)
     */
    async generatePDFFromExcel(piId: string, empresaId: string, res: Response) {
        logger.debug(`[PIService] Gerando PDF from Excel para PI ${piId}...`);
        try {
            // 1. Gerar o Excel em memória (mesmo código do generateExcel)
            const pi = await this.getById(piId, empresaId);

            if (!pi) {
                throw new AppError('PI não encontrada.', 404);
            }

            // getById retorna PopulatedPI — sem cast necessário
            const empresa = await Empresa.findById(empresaId)
                .select('nome cnpj endereco telefone')
                .lean();

            if (!empresa) {
                throw new AppError('Empresa não encontrada.', 404);
            }

            const piData = {
                cliente: {
                    nome: pi.clienteId?.nome || 'N/A',
                    cnpj: pi.clienteId?.cpfCnpj || 'N/A',
                    endereco: `${pi.clienteId?.endereco || ''}, ${pi.clienteId?.cidade || ''}`.trim(),
                    telefone: pi.clienteId?.telefone || 'N/A',
                    responsavel: pi.clienteId?.responsavel || 'N/A',
                    segmento: pi.clienteId?.segmento || 'N/A'
                },
                empresa: {
                    nome: empresa.nome || 'N/A',
                    cnpj: empresa.cnpj || 'N/A',
                    endereco: (empresa.endereco || '').trim(),
                    telefone: empresa.telefone || 'N/A'
                },
                pi: {
                    numero: pi._id.toString(),
                    produto: pi.produto || 'OUTDOOR',
                    descricao: pi.descricao || 'N/A',
                    periodo: pi.descricaoPeriodo || pi.tipoPeriodo || 'MENSAL',
                    dataInicio: pi.dataInicio ? new Date(pi.dataInicio).toLocaleDateString('pt-BR') : 'N/A',
                    dataFim: pi.dataFim ? new Date(pi.dataFim).toLocaleDateString('pt-BR') : 'N/A',
                    formaPagamento: pi.formaPagamento || 'A combinar',
                    valorProducao: pi.valorProducao || 0,
                    valorTotal: pi.valorTotal || 0
                },
                placas: (pi.placas || []).map((placa) => ({
                    numero: placa.numero_placa || placa.codigo || 'N/A',
                    localizacao: `${placa.nomeDaRua || ''} - ${placa.regiao?.nome || ''}`.trim(),
                    tamanho: placa.tamanho || 'N/A'
                }))
            };

            const templatePath = path.join(process.cwd(), '..', 'templates', 'PI.xlsx');
            
            try {
                await fs.access(templatePath);
            } catch (err: any) {
                throw new AppError('Template Excel não encontrado.', 500);
            }

            const workbook = await XlsxPopulate.fromFileAsync(templatePath);
            const sheet = workbook.sheet(0);

            // Preenche dados
            sheet.cell('B3').value(piData.empresa.nome);
            sheet.cell('D3').value(piData.cliente.nome);
            sheet.cell('F3').value(piData.pi.produto);
            sheet.cell('H3').value(piData.pi.numero);
            sheet.cell('B5').value(piData.empresa.endereco);
            sheet.cell('D5').value(piData.cliente.endereco);
            sheet.cell('F5').value(new Date().toLocaleDateString('pt-BR'));
            sheet.cell('H5').value(piData.pi.periodo);
            sheet.cell('B7').value(`${piData.empresa.cnpj}\n${piData.empresa.telefone}`);
            sheet.cell('D7').value(`${piData.cliente.cnpj}\n${piData.cliente.telefone}`);
            sheet.cell('F7').value(piData.cliente.responsavel);
            sheet.cell('H7').value(piData.cliente.segmento);
            sheet.cell('B9').value('Atendimento');
            sheet.cell('D9').value(piData.pi.formaPagamento);
            sheet.cell('F9').value(piData.pi.dataInicio);
            sheet.cell('H9').value(piData.pi.dataFim);
            sheet.cell('B11').value(piData.pi.descricao);
            
            const valorVeiculacao = piData.pi.valorTotal - piData.pi.valorProducao;
            sheet.cell('F18').value(piData.pi.valorProducao);
            sheet.cell('F19').value(valorVeiculacao);
            sheet.cell('F20').value(piData.pi.valorTotal);

            if (piData.placas.length > 0) {
                const descricaoPlacas = piData.placas
                    .map((placa: { numero: string; localizacao: string; tamanho: string }, idx: number) => `${idx + 1}. PLACA ${placa.numero} - ${placa.localizacao} (${placa.tamanho})`)
                    .join('\n');
                sheet.cell('B13').value(`PLACAS:\n${descricaoPlacas}`);
            }

            // 2. Gera buffer do Excel
            const xlsxBuffer = await workbook.outputAsync();

            // 3. Converte para PDF
            logger.debug(`[PIService] Convertendo Excel para PDF...`);
            const pdfBuffer = await convertXlsxBufferToPdf(xlsxBuffer, {
                orientation: 'landscape',
                format: 'A4'
            });

            // 4. Envia PDF
            const filename = `PI_${piId}_${piData.cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            res.send(pdfBuffer);
            logger.info(`[PIService] PDF (from Excel) ${filename} gerado com sucesso`);

        } catch (error: any) {
            logger.error(`[PIService] Erro ao gerar PDF from Excel da PI ${piId}: ${error.message}`, { stack: error.stack });
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao gerar PDF: ${error.message}`, 500);
        }
    }
    
    /**
     * Aprova uma PI: valida disponibilidade, cria/renova reserva temporal, muda status para APPROVED.
     */
    async approve(piId: string, empresaId: string, userId: string) {
        const pi = await PropostaInterna.findOne({ _id: piId, empresaId }).lean();
        if (!pi) throw new AppError('PI não encontrada.', 404);

        const approvableStatuses = ['DRAFT', 'PENDING_APPROVAL', 'em_andamento'];
        if (!approvableStatuses.includes(pi.status)) {
            throw new AppError(`PI não pode ser aprovada no status atual: ${pi.status}`, 400);
        }

        const startDate = (pi as any).startDate || (pi as any).dataInicio;
        const endDate   = (pi as any).endDate   || (pi as any).dataFim;
        if (!startDate || !endDate) throw new AppError('PI sem período definido.', 400);

        const plateIds = ((pi as any).placas || []).map((p: unknown) => String(p));
        if (plateIds.length > 0) {
            await temporalEngine.assertMultiplePlatesAvailable(plateIds, startDate, endDate, {
                empresaId,
                sourceType: 'PI',
                sourceId: piId,
            });

            await temporalEngine.replaceSourceReservations({
                empresaId,
                sourceType: 'PI',
                sourceId: piId,
                plateIds,
                customerId: String((pi as any).clienteId),
                startDate,
                endDate,
                status: 'RESERVED',
                reason: `Reserva aprovada - PI ${(pi as any).pi_code}`,
            });
        }

        const updated = await PropostaInterna.findOneAndUpdate(
            { _id: piId, empresaId },
            { $set: { status: 'APPROVED', updatedBy: userId } },
            { new: true }
        );
        return updated!.toJSON();
    }

    /**
     * Rejeita uma PI: cancela reservas temporais, muda status para REJECTED.
     */
    async reject(piId: string, empresaId: string, userId: string) {
        const pi = await PropostaInterna.findOne({ _id: piId, empresaId }).lean();
        if (!pi) throw new AppError('PI não encontrada.', 404);

        const rejectableStatuses = ['DRAFT', 'PENDING_APPROVAL', 'em_andamento'];
        if (!rejectableStatuses.includes(pi.status)) {
            throw new AppError(`PI não pode ser rejeitada no status atual: ${pi.status}`, 400);
        }

        await temporalEngine.cancelTemporalReservation('PI', piId, empresaId);

        const updated = await PropostaInterna.findOneAndUpdate(
            { _id: piId, empresaId },
            { $set: { status: 'REJECTED', updatedBy: userId } },
            { new: true }
        );
        return updated!.toJSON();
    }

    /**
     * Cancela uma PI: cancela reservas temporais, muda status para CANCELLED.
     * Não cancela se já houver contrato gerado (CONTRACT_GENERATED).
     */
    async cancel(piId: string, empresaId: string, userId: string) {
        const pi = await PropostaInterna.findOne({ _id: piId, empresaId }).lean();
        if (!pi) throw new AppError('PI não encontrada.', 404);

        if (pi.status === 'CONTRACT_GENERATED') {
            throw new AppError('PI com contrato gerado não pode ser cancelada diretamente. Cancele o contrato primeiro.', 400);
        }
        if (pi.status === 'CANCELLED') {
            throw new AppError('PI já está cancelada.', 400);
        }

        await temporalEngine.cancelTemporalReservation('PI', piId, empresaId);

        const updated = await PropostaInterna.findOneAndUpdate(
            { _id: piId, empresaId },
            { $set: { status: 'CANCELLED', updatedBy: userId } },
            { new: true }
        );
        return updated!.toJSON();
    }

    /**
     * Gera contrato a partir de uma PI APPROVED.
     * Promove reservas PI → CONTRACT no Temporal Engine.
     * Atualiza PI para CONTRACT_GENERATED.
     */
    async generateContractFromPI(piId: string, empresaId: string) {
        const pi = await PropostaInterna.findOne({ _id: piId, empresaId }).lean();
        if (!pi) throw new AppError('PI não encontrada.', 404);

        if (pi.status !== 'APPROVED') {
            throw new AppError(`Contrato só pode ser gerado de PI com status APPROVED. Status atual: ${pi.status}`, 400);
        }

        const contratoExistente = await Contrato.findOne({ piId, empresaId }).lean();
        if (contratoExistente) {
            throw new AppError('Um contrato para esta PI já foi gerado.', 409);
        }

        const novoContrato = new Contrato({
            piId: pi._id,
            empresaId,
            clienteId: (pi as any).clienteId,
            status: 'rascunho',
            numero: `CONT-${Date.now()}`,
        });
        await novoContrato.save();

        await temporalEngine.promotePiReservationToContract(piId, String(novoContrato._id), empresaId);

        await PropostaInterna.updateOne(
            { _id: piId, empresaId },
            { $set: { status: 'CONTRACT_GENERATED' } }
        );

        await novoContrato.populate([
            { path: 'clienteId', select: 'nome' },
            { path: 'piId', select: 'valorTotal startDate endDate dataInicio dataFim pi_code' },
        ]);

        return novoContrato.toJSON();
    }

    /**
     * Verifica disponibilidade de placas para um período.
     * Consulta o Temporal Engine e retorna placas agrupadas por status.
     */
    async checkAvailability(params: {
        startDate: string;
        endDate: string;
        regionId?: string;
        excludePiId?: string;
    }, empresaId: string) {
        const { startDate, endDate, regionId, excludePiId } = params;

        if (!startDate || !endDate) {
            throw new AppError('startDate e endDate são obrigatórios.', 400);
        }

        // Busca placas da empresa (com filtro opcional de região)
        const placaQuery: Record<string, unknown> = { empresaId };
        if (regionId) placaQuery.regiao = regionId;

        const placas = await Placa.find(placaQuery)
            .select('_id numero_placa nomeDaRua regiao codigo')
            .populate({ path: 'regiao', select: 'nome' })
            .lean();

        const plateIds = placas.map((p: any) => String(p._id));

        const ignoreSource = excludePiId
            ? { sourceType: 'PI' as const, sourceId: excludePiId }
            : undefined;

        const results = await Promise.all(
            plateIds.map(async (plateId: string) => {
                const result = await temporalEngine.checkPlateAvailability(
                    plateId,
                    startDate,
                    endDate,
                    { empresaId, ignoreSource }
                );
                return { plateId, ...result };
            })
        );

        const plateMap = new Map(placas.map((p: any) => [String(p._id), p]));

        const available: unknown[] = [];
        const reserved: unknown[] = [];
        const contracted: unknown[] = [];
        const blocked: unknown[] = [];
        const conflicts: unknown[] = [];

        for (const result of results) {
            const placa = plateMap.get(result.plateId);
            if (!placa) continue;

            const summary = { ...placa, conflicts: result.conflicts };

            if (result.available) {
                available.push(summary);
            } else {
                const conflict = result.conflicts[0];
                const sourceType = conflict?.conflictingReservation?.sourceType;
                const status     = conflict?.conflictingReservation?.status;

                if (sourceType === 'CONTRACT' || status === 'ACTIVE') {
                    contracted.push(summary);
                } else if (sourceType === 'MANUAL_BLOCK' || status === 'BLOCKED') {
                    blocked.push(summary);
                } else if (sourceType === 'PI' || status === 'RESERVED') {
                    reserved.push(summary);
                } else {
                    conflicts.push(summary);
                }
            }
        }

        return { available, reserved, contracted, blocked, conflicts };
    }

    /**
     * [PARA O CRON JOB] Marca como vencida toda PI cujo período expirou sem virar contrato.
     * Cobre status V4.1 (DRAFT, PENDING_APPROVAL, APPROVED) e legado (em_andamento).
     * Para PIs APPROVED, cancela as reservas temporais antes de mudar o status.
     *
     * Isolamento multi-tenant: itera por empresa usando Empresa.find({}) (modelo global)
     * e processa cada tenant isoladamente, garantindo que updateMany sempre inclui empresaId.
     */
    static async updateVencidas() {
        const hoje = new Date();
        logger.info(`[PIService-Cron] Verificando PIs vencidas... (Data: ${hoje.toISOString()})`);

        const expirableStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'em_andamento'];

        try {
            // Iterar por empresa: Empresa é modelo global, não tenant-scoped.
            const empresas = await Empresa.find({}).select('_id').lean();
            let totalVencidas = 0;
            let totalCancelledReservations = 0;

            for (const empresa of empresas) {
                const empresaId = String(empresa._id);
                try {
                    const pisVencidas = await PropostaInterna.find({
                        empresaId,
                        status: { $in: expirableStatuses },
                        $or: [
                            { endDate: { $lt: hoje } },
                            { dataFim: { $lt: hoje } },
                        ],
                    }).lean();

                    if (pisVencidas.length === 0) continue;

                    logger.info(`[PIService-Cron] Empresa ${empresaId}: ${pisVencidas.length} PIs vencidas.`);

                    // Cancel temporal reservations for APPROVED PIs
                    const approvedExpired = pisVencidas.filter((pi: any) => pi.status === 'APPROVED');
                    for (const pi of approvedExpired) {
                        try {
                            await temporalEngine.cancelTemporalReservation('PI', String(pi._id), empresaId);
                            totalCancelledReservations++;
                        } catch (err: any) {
                            logger.warn(`[PIService-Cron] Não foi possível cancelar reserva PI ${pi._id}: ${err.message}`);
                        }
                    }

                    const ids = pisVencidas.map((pi: any) => pi._id);
                    const result = await PropostaInterna.updateMany(
                        { _id: { $in: ids }, empresaId },
                        { $set: { status: 'vencida' } },
                    );
                    totalVencidas += result.modifiedCount;
                } catch (empresaErr: any) {
                    logger.error(`[PIService-Cron] Erro ao processar empresa ${empresaId}: ${empresaErr.message}`);
                }
            }

            logger.info(
                `[PIService-Cron] ${totalVencidas} PIs marcadas como vencida. ` +
                `Reservas canceladas: ${totalCancelledReservations}.`
            );
        } catch (error: any) {
            logger.error(`[PIService-Cron] Erro ao atualizar PIs vencidas: ${error.message}`, { stack: error.stack });
        }
    }
}

export default PIService;
