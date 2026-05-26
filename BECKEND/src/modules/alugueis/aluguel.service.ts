// src/modules/alugueis/aluguel.service.ts
import mongoose, { Types, ClientSession } from 'mongoose';
import Aluguel from './Aluguel';
import Placa from '@modules/placas/Placa';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';
import BiWeekHelpers from '@utils/biWeekHelpers';
import PeriodService from '@shared/container/period.service';
import aluguelNotificationService from './aluguel-notification.service';
import { IAluguel } from '../../types/models.d';
import { CreateAluguelInput } from '../../validators/aluguelSchemas';

// Verifica se está em ambiente de teste (JEST_WORKER_ID é definido pelo Jest)
const isTestEnvironment = process.env.JEST_WORKER_ID !== undefined;
const useTransactions = !isTestEnvironment; // Desativa transações APENAS em teste

if (!useTransactions) {
    console.warn('\n[[[ ALERTA DE TESTE: Transações Mongoose DESABILITADAS ]]]\n');
    logger.warn('[AluguelService] TRANSAÇÕES MONGOOSE DESABILITADAS (Ambiente de Teste Detectado via JEST_WORKER_ID)');
}

interface PopulatedCliente {
    _id: Types.ObjectId;
    nome: string;
    logo_url?: string;
}

interface PopulatedPlaca {
    _id: Types.ObjectId;
    numero_placa: string;
}

interface FormattedAluguel {
    id: string;
    cliente_nome: string;
    cliente: PopulatedCliente | null;
    placa?: PopulatedPlaca;
    placaId: Types.ObjectId | string;
    clienteId: Types.ObjectId | string;
    empresaId: Types.ObjectId | string;
    periodType?: string;
    startDate?: Date;
    endDate?: Date;
    biWeekIds?: string[];
    tipo?: string;
    status?: string;
    observacoes?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ProcessedPeriod {
    periodType: string;
    startDate: Date;
    endDate: Date;
    biWeekIds: string[];
    biWeeks?: Array<{ _id: Types.ObjectId; [key: string]: unknown }>;
}

class AluguelService {
    constructor() {}

    /**
     * Formata um documento de aluguel para resposta JSON
     */
    private formatAluguel(doc: IAluguel): FormattedAluguel {
        const obj = doc.toJSON() as Record<string, unknown>;

        // Tipagem segura para cliente populado
        const clientePopulado = typeof doc.clienteId === 'object' && doc.clienteId && 'nome' in doc.clienteId
            ? (doc.clienteId as unknown as PopulatedCliente)
            : null;

        const clienteNome = clientePopulado?.nome || 'Cliente Apagado';

        const formatted: FormattedAluguel = {
            id: obj.id as string || obj._id?.toString() || '',
            cliente_nome: clienteNome,
            cliente: clientePopulado,
            placaId: obj.placaId as Types.ObjectId | string,
            clienteId: obj.clienteId as Types.ObjectId | string,
            empresaId: obj.empresaId as Types.ObjectId | string,
            periodType: obj.periodType as string | undefined,
            startDate: obj.startDate as Date | undefined,
            endDate: obj.endDate as Date | undefined,
            biWeekIds: obj.biWeekIds as string[] | undefined,
            tipo: obj.tipo as string | undefined,
            status: obj.status as string | undefined,
            observacoes: obj.observacoes as string | undefined,
            createdAt: obj.createdAt as Date | undefined,
            updatedAt: obj.updatedAt as Date | undefined
        };

        if (obj.placa) {
            formatted.placa = obj.placa as PopulatedPlaca;
        }

        return formatted;
    }

    /**
     * Obtém todos os alugueis para uma placa específica, retornando objetos simples.
     */
    async getAlugueisByPlaca(placaId: string, empresaId: string): Promise<FormattedAluguel[]> {
        logger.info(`[AluguelService] Iniciando getAlugueisByPlaca para placa ${placaId} na empresa ${empresaId}.`);

        try {
            logger.debug('[AluguelService] Executando Aluguel.find()...');

            const alugueisDocs = await Aluguel.find({ placaId: placaId, empresaId: empresaId })
                .populate('clienteId', 'nome logo_url')
                .sort({ startDate: -1, data_inicio: -1 })
                .exec();

            logger.info(`[AluguelService] Query concluída. ${alugueisDocs.length} alugueis encontrados para placa ${placaId}.`);
            logger.debug('[AluguelService] Iniciando conversão para JSON e mapeamento...');

            const alugueis = alugueisDocs.map(doc => this.formatAluguel(doc));

            logger.debug('[AluguelService] Mapeamento toJSON e cliente_nome concluído.');
            return alugueis;

        } catch (error: unknown) {
            logger.error(`[AluguelService] Erro final em getAlugueisByPlaca: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, { 
                stack: error instanceof Error ? error.stack : undefined 
            });

            if (error instanceof AppError) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            throw new AppError(`Erro interno ao buscar histórico de alugueis: ${errorMessage}`, 500);
        }
    }

    /**
     * Cria um novo aluguel (reserva) para uma placa, usando transação (exceto em testes).
     * [PERÍODO UNIFICADO] Usa PeriodService para processar períodos (bi-week ou custom)
     */
    async createAluguel(
        aluguelData: CreateAluguelInput & { empresaId: string },
        empresaId: string
    ): Promise<FormattedAluguel> {
        logger.info(`[AluguelService] Tentando criar aluguel para empresa ${empresaId}.`);
        const { placaId, clienteId } = aluguelData;

        // [PERÍODO UNIFICADO] Processar período usando PeriodService
        let period: ProcessedPeriod;
        try {
            logger.debug('[AluguelService] Processando período com PeriodService...');
            period = await PeriodService.processPeriodInput(aluguelData) as ProcessedPeriod;

            logger.info(`[AluguelService] Período processado: Tipo=${period.periodType}`);
            logger.info(`[AluguelService] Datas: ${PeriodService.formatDate(period.startDate)} - ${PeriodService.formatDate(period.endDate)}`);
            if (period.biWeekIds && period.biWeekIds.length > 0) {
                logger.info(`[AluguelService] Bi-semanas: ${period.biWeekIds.join(', ')}`);
            }
        } catch (periodError: unknown) {
            const errorMessage = periodError instanceof Error ? periodError.message : 'Erro desconhecido ao processar período';
            logger.error(`[AluguelService] Erro ao processar período: ${errorMessage}`);
            throw periodError instanceof AppError ? periodError : new AppError(errorMessage, 400);
        }

        const session: ClientSession | null = useTransactions ? await mongoose.startSession() : null;
        if (session) {
            logger.debug('[AluguelService] Iniciando transação Mongoose para criar aluguel.');
            session.startTransaction();
        } else {
            logger.debug('[AluguelService] Transações desabilitadas (ambiente de teste).');
        }

        try {
            // [PERÍODO UNIFICADO] Verificação de conflitos usando novos campos
            logger.debug(`[AluguelService] Verificando conflitos para placa ${placaId}...`);

            const conflictingAluguel = await Aluguel.findOne({
                placaId: placaId,
                empresaId: empresaId,
                startDate: { $lt: period.endDate },
                endDate: { $gt: period.startDate }
            }).lean().session(session).exec();

            if (conflictingAluguel) {
                logger.warn(`[AluguelService] CONFLITO DETECTADO! Aluguel existente ID ${conflictingAluguel._id} conflita com novo período.`);
                throw new AppError(
                    `Esta placa (ID: ${placaId}) já está reservada total ou parcialmente no período solicitado.`,
                    409
                );
            }
            logger.debug(`[AluguelService] Nenhum conflito encontrado.`);

            // [PERÍODO UNIFICADO] Cria o aluguel com novos campos + legado para compatibilidade
            logger.debug(`[AluguelService] Tentando salvar novo aluguel no DB.`);
            const createOptions = session ? { session } : {};

            const [novoAluguelDoc] = await Aluguel.create([{
                placaId: placaId,
                clienteId: clienteId,
                empresaId: empresaId,
                // [NOVOS CAMPOS UNIFICADOS]
                periodType: period.periodType,
                startDate: period.startDate,
                endDate: period.endDate,
                biWeekIds: period.biWeekIds,
                biWeeks: period.biWeeks ? period.biWeeks.map((bw: { _id: Types.ObjectId; [key: string]: unknown }) => bw._id) : [],
                // [CAMPOS LEGADO] Mantidos para compatibilidade
                data_inicio: period.startDate,
                data_fim: period.endDate,
                bi_week_ids: period.biWeekIds,
                // Campos opcionais do input
                tipo: aluguelData.tipo || 'manual',
                pi_code: aluguelData.pi_code,
                proposta_interna: aluguelData.proposta_interna,
                observacoes: aluguelData.observacoes,
                status: 'ativo'
            }], createOptions);

            if (!novoAluguelDoc) {
                throw new AppError('Falha ao criar aluguel no banco de dados.', 500);
            }

            logger.info(`[AluguelService] Aluguel ${novoAluguelDoc._id} criado ${session ? 'na transação' : ''}.`);
            logger.info(`[AluguelService] Tipo: ${period.periodType}`);
            if (period.biWeekIds && period.biWeekIds.length > 0) {
                logger.info(`[AluguelService] Bi-semanas vinculadas: ${period.biWeekIds.join(', ')}`);
            }

            // NOTA: Campo 'disponivel' é usado APENAS para manutenção manual.
            // O status de aluguel é determinado dinamicamente pela existência de aluguéis ativos.

            // Commita condicionalmente
            if (session) {
                logger.debug(`[AluguelService] Commitando transação ${novoAluguelDoc._id}.`);
                await session.commitTransaction();
            }
            logger.info(`[AluguelService] Aluguel ${novoAluguelDoc._id} processado com sucesso.`);

            // Busca e formata o resultado (usando toJSON)
            const aluguelCriado = await Aluguel.findById(novoAluguelDoc._id)
                .populate('clienteId', 'nome logo_url')
                .populate('placaId', 'numero_placa')
                .populate('biWeeks')
                .exec();

            if (!aluguelCriado) {
                logger.error(`[AluguelService] ERRO INESPERADO: Aluguel ${novoAluguelDoc._id} não encontrado após criação/commit.`);
                throw new AppError('Erro ao buscar aluguel recém-criado.', 500);
            }

            const aluguelFormatado = this.formatAluguel(aluguelCriado);

            // [NOVO] Dispara notificações em tempo real (não-bloqueante) após commit da transação
            aluguelNotificationService.notifyAluguelCriado(
                aluguelCriado,
                new Types.ObjectId(empresaId),
                typeof aluguelCriado.placaId === 'object' && 'numero_placa' in aluguelCriado.placaId
                    ? aluguelCriado.placaId.numero_placa
                    : undefined,
                aluguelFormatado.cliente_nome
            ).catch(err => {
                logger.error(`[AluguelService] Erro ao enviar notificações (não-bloqueante): ${err.message}`);
            });

            return aluguelFormatado;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            
            if (session && session.inTransaction()) {
                logger.warn(`[AluguelService] Abortando transação devido a erro: ${errorMessage}`);
                await session.abortTransaction();
            }
            
            logger.error(`[AluguelService] Erro ao criar aluguel: ${errorMessage}`, {
                stack: error instanceof Error ? error.stack : undefined,
                status: error instanceof AppError ? error.status : undefined
            });

            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao criar aluguel: ${errorMessage}`, 500);
        } finally {
            if (session) {
                logger.debug('[AluguelService] Finalizando sessão Mongoose.');
                await session.endSession();
            }
        }
    }

    /**
     * Apaga um aluguel (cancela uma reserva) e atualiza o status da placa se necessário, usando transação (exceto em testes).
     */
    async deleteAluguel(aluguelId: string, empresaId: string): Promise<{ success: boolean; message: string }> {
        logger.info(`[AluguelService] Tentando apagar aluguel ${aluguelId} para empresa ${empresaId}.`);
        const session: ClientSession | null = useTransactions ? await mongoose.startSession() : null;
        if (session) {
            logger.debug('[AluguelService] Iniciando transação Mongoose para apagar aluguel.');
            session.startTransaction();
        } else {
            logger.debug('[AluguelService] Transações desabilitadas (ambiente de teste).');
        }

        try {
            // 1. Encontra o aluguel
            logger.debug(`[AluguelService] Buscando aluguel ${aluguelId}...`);
            const aluguel = await Aluguel.findOne({ _id: aluguelId, empresaId: empresaId })
                .select('placaId startDate endDate data_inicio data_fim')
                .lean()
                .session(session)
                .exec();

            if (!aluguel) {
                throw new AppError('Aluguel não encontrado.', 404);
            }
            const placaId = aluguel.placaId;
            logger.debug(`[AluguelService] Aluguel ${aluguelId} encontrado, placa ${placaId}.`);

            // 2. Apaga o aluguel
            logger.debug(`[AluguelService] Apagando aluguel ${aluguelId} do DB.`);
            const deleteOptions = session ? { session } : {};
            const deleteResult = await Aluguel.deleteOne({ _id: aluguelId }, deleteOptions);

            if (deleteResult.deletedCount === 0) {
                throw new AppError('Falha ao apagar o aluguel.', 500);
            }
            logger.info(`[AluguelService] Aluguel ${aluguelId} apagado ${session ? 'na transação' : ''}.`);

            // NOTA: Campo 'disponivel' é usado APENAS para manutenção manual.
            // O status de aluguel é determinado dinamicamente pela existência de aluguéis ativos.

            // Commita condicionalmente
            if (session) {
                logger.debug(`[AluguelService] Commitando transação delete ${aluguelId}.`);
                await session.commitTransaction();
            }
            logger.info(`[AluguelService] Aluguel ${aluguelId} apagado com sucesso.`);

            // Dispara notificações (não-bloqueante)
            aluguelNotificationService.notifyAluguelCancelado(
                aluguelId,
                new Types.ObjectId(empresaId)
            ).catch(err => {
                logger.error(`[AluguelService] Erro ao enviar notificações de cancelamento: ${err.message}`);
            });

            return { success: true, message: 'Aluguel cancelado com sucesso.' };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            
            if (session && session.inTransaction()) {
                logger.warn(`[AluguelService] Abortando transação delete devido a erro: ${errorMessage}`);
                await session.abortTransaction();
            }
            
            logger.error(`[AluguelService] Erro ao apagar aluguel: ${errorMessage}`, {
                stack: error instanceof Error ? error.stack : undefined,
                status: error instanceof AppError ? error.status : undefined
            });

            if (error instanceof AppError) throw error;
            throw new AppError(`Erro interno ao cancelar aluguel: ${errorMessage}`, 500);
        } finally {
            if (session) {
                logger.debug('[AluguelService] Finalizando sessão Mongoose.');
                await session.endSession();
            }
        }
    }

    /**
     * [BI-WEEK SYNC] Busca aluguéis por bi-semana
     * [PERÍODO UNIFICADO] Usa campo biWeekIds (novo) mas aceita bi_week_ids (legado)
     */
    async getAlugueisByBiWeek(biWeekId: string, empresaId: string): Promise<FormattedAluguel[]> {
        logger.info(`[AluguelService] Buscando aluguéis da bi-semana ${biWeekId} para empresa ${empresaId}`);

        try {
            // [PERÍODO UNIFICADO] Busca usando campo novo OU legado (compatibilidade)
            const alugueis = await Aluguel.find({
                $or: [
                    { biWeekIds: biWeekId },  // Novo campo
                    { bi_week_ids: biWeekId } // Legado
                ],
                empresaId: empresaId
            })
                .populate('clienteId', 'nome logo_url')
                .populate('placaId', 'numero_placa')
                .populate('biWeeks')
                .sort({ startDate: -1, data_inicio: -1 })
                .exec();

            logger.info(`[AluguelService] ${alugueis.length} aluguéis encontrados para bi-semana ${biWeekId}`);

            return alugueis.map(doc => this.formatAluguel(doc));

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            logger.error(`[AluguelService] Erro ao buscar aluguéis por bi-semana: ${errorMessage}`);
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro ao buscar aluguéis por bi-semana: ${errorMessage}`, 500);
        }
    }

    /**
     * [BI-WEEK SYNC] Busca placas disponíveis em uma bi-semana
     * [PERÍODO UNIFICADO] Usa novos campos mas mantém compatibilidade
     */
    async getPlacasDisponiveisByBiWeek(biWeekId: string, empresaId: string): Promise<any[]> {
        logger.info(`[AluguelService] Buscando placas disponíveis na bi-semana ${biWeekId} para empresa ${empresaId}`);

        try {
            // Busca a bi-semana para obter as datas
            const biWeek = await BiWeekHelpers.findBiWeeksByIds([biWeekId]);

            if (!biWeek || biWeek.length === 0) {
                throw new AppError(`Bi-semana ${biWeekId} não encontrada.`, 404);
            }

            // Busca todas as placas da empresa
            const todasPlacas = await Placa.find({ empresaId: empresaId, ativo: true })
                .populate('regiao', 'nome')
                .lean()
                .exec();

            // [PERÍODO UNIFICADO] Busca aluguéis que conflitam com esta bi-semana (novo OU legado)
            const alugueisConflitantes = await Aluguel.find({
                empresaId: empresaId,
                $or: [
                    { biWeekIds: biWeekId },  // Novo campo
                    { bi_week_ids: biWeekId } // Legado
                ]
            })
                .select('placaId')
                .lean()
                .exec();

            const placasAlugadas = new Set(alugueisConflitantes.map(a => a.placaId.toString()));

            // Filtra placas disponíveis
            const placasDisponiveis = todasPlacas.filter((placa) => {
                return placa.disponivel !== false && !placasAlugadas.has(placa._id.toString());
            });

            logger.info(`[AluguelService] ${placasDisponiveis.length} placas disponíveis na bi-semana ${biWeekId}`);

            return placasDisponiveis;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            logger.error(`[AluguelService] Erro ao buscar placas disponíveis: ${errorMessage}`);
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro ao buscar placas disponíveis: ${errorMessage}`, 500);
        }
    }

    /**
     * [BI-WEEK SYNC] Gera relatório de ocupação por bi-semana
     */
    async getRelatorioOcupacaoBiWeek(biWeekId: string, empresaId: string): Promise<any> {
        logger.info(`[AluguelService] Gerando relatório de ocupação para bi-semana ${biWeekId}`);

        try {
            const biWeek = await BiWeekHelpers.findBiWeeksByIds([biWeekId]);

            if (!biWeek || biWeek.length === 0) {
                throw new AppError(`Bi-semana ${biWeekId} não encontrada.`, 404);
            }

            const bw = biWeek[0];
            if (!bw) {
                throw new AppError(`Bi-semana ${biWeekId} inválida.`, 500);
            }

            // Busca dados
            const todasPlacas = await Placa.countDocuments({ empresaId: empresaId, ativo: true });
            const alugueis = await this.getAlugueisByBiWeek(biWeekId, empresaId);
            const placasDisponiveis = await this.getPlacasDisponiveisByBiWeek(biWeekId, empresaId);

            const placasAlugadas = alugueis.length;
            const placasLivres = placasDisponiveis.length;
            const taxaOcupacao = todasPlacas > 0 ? ((placasAlugadas / todasPlacas) * 100).toFixed(2) : 0;

            return {
                bi_week: {
                    id: bw.bi_week_id,
                    numero: bw.numero,
                    ano: bw.ano,
                    periodo: `${BiWeekHelpers.formatDate(bw.dataInicio)} - ${BiWeekHelpers.formatDate(bw.dataFim)}`,
                    descricao: bw.descricao || ''
                },
                estatisticas: {
                    total_placas: todasPlacas,
                    placas_alugadas: placasAlugadas,
                    placas_disponiveis: placasLivres,
                    taxa_ocupacao: `${taxaOcupacao}%`
                },
                alugueis: alugueis,
                placas_disponiveis: placasDisponiveis
            };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            logger.error(`[AluguelService] Erro ao gerar relatório: ${errorMessage}`);
            if (error instanceof AppError) throw error;
            throw new AppError(`Erro ao gerar relatório: ${errorMessage}`, 500);
        }
    }
}

export default AluguelService;
