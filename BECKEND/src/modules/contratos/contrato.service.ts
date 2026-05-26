// services/contratoService.ts
import Contrato from './Contrato';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import User from '@modules/users/User';
import AppError from '@shared/container/AppError';
import logger from '@shared/container/logger';
import pdfService from '@shared/container/pdf.service';
import piGen from '../../../src/PISystemGen/generator';
import * as XlsxPopulate from 'xlsx-populate';
import * as path from 'path';
import * as fs from 'fs/promises';
import xlsxToPdfConverter from '@shared/utils/xlsx-to-pdf.converter';
import { Response } from 'express';

interface ContratoQueryParams {
    page?: string | number;
    limit?: string | number;
    sortBy?: string;
    order?: 'asc' | 'desc';
    status?: string;
    clienteId?: string;
}

interface ContratoUpdateData {
    status?: string;
    [key: string]: any;
}

interface ContratoQuery {
    empresaId: string;
    status?: string;
    clienteId?: string;
}

class ContratoService {

    /**
     * Cria um Contrato a partir de uma PI
     */
    async create(piId: string, empresaId: string): Promise<any> {
        logger.info(`[ContratoService] Tentando criar contrato a partir da PI ${piId}`);
        
        try {
            // 1. Verifica se a PI existe e pertence à empresa
            const pi = await PropostaInterna.findOne({ _id: piId, empresaId: empresaId }).lean();
            if (!pi) {
                throw new AppError('Proposta Interna (PI) não encontrada.', 404);
            }

            // 2. Verifica se já existe um contrato para esta PI
            const existe = await Contrato.findOne({ piId: piId, empresaId: empresaId }).lean();
            if (existe) {
                throw new AppError('Um contrato para esta PI já foi gerado.', 409);
            }

            // 3. Cria o contrato
            const novoContrato = new Contrato({
                piId: pi._id,
                empresaId: empresaId,
                clienteId: pi.clienteId,
                status: 'rascunho',
                numero: `CONT-${Date.now()}` // Gera número temporário
            });

            await novoContrato.save();
            
            // Popula os dados para o retorno
            await novoContrato.populate([
                { path: 'clienteId', select: 'nome' },
                { path: 'piId', select: 'valorTotal dataInicio dataFim' }
            ]);

            // Validar se populate foi bem-sucedido
            if (!novoContrato.clienteId || !novoContrato.piId) {
                throw new AppError('Erro ao carregar dados relacionados do contrato (cliente ou PI podem ter sido deletados).', 500);
            }

            return novoContrato.toJSON();

        } catch (error) {
            if (error instanceof AppError) throw error;
            
            // Type guard para erros conhecidos
            if (error && typeof error === 'object') {
                const err = error as any;
                logger.error(`[ContratoService] Erro ao criar contrato: ${err.message || 'Erro desconhecido'}`, { stack: err.stack });
                
                // Trata o erro de 'unique' do Mongoose
                if (err.code === 11000) {
                    throw new AppError('Um contrato para esta PI já foi gerado (Erro 11000).', 409);
                }
                throw new AppError(`Erro interno ao criar contrato: ${err.message || 'Erro desconhecido'}`, 500);
            }
            throw new AppError('Erro interno ao criar contrato', 500);
        }
    }

    // --- NOVO MÉTODO (CRUD - LISTAR) ---
    /**
     * Lista todos os Contratos (com paginação e filtros)
     */
    async getAll(empresaId: string, queryParams: ContratoQueryParams): Promise<any> {
        const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', status, clienteId } = queryParams;

        const pageInt = Math.max(1, parseInt(String(page), 10) || 1);
        const limitInt = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
        const skip = (pageInt - 1) * limitInt;
        const sortOrder = order === 'desc' ? -1 : 1;

        // Whitelist de campos ordenáveis
        const camposOrdenaveis = ['createdAt', 'updatedAt', 'status'];
        const campoOrdenacaoFinal = camposOrdenaveis.includes(sortBy) ? sortBy : 'createdAt';

        const query: ContratoQuery = { empresaId: empresaId };
        if (status) query.status = status;
        if (clienteId) query.clienteId = clienteId;
        
        try {
            const [contratos, totalDocs] = await Promise.all([
                Contrato.find(query)
                    // População seletiva: Traz apenas o necessário para a tabela
                    .populate('clienteId', 'nome') 
                    .populate('piId', 'valorTotal dataInicio dataFim')
                    .sort({ [campoOrdenacaoFinal]: sortOrder })
                    .skip(skip)
                    .limit(limitInt)
                    .lean(),
                Contrato.countDocuments(query)
            ]);

            const totalPages = Math.ceil(totalDocs / limitInt);
            const pagination = { totalDocs, totalPages, currentPage: pageInt, limit: limitInt };

            return { data: contratos, pagination };
        } catch (error) {
            const err = error as any;
            logger.error(`[ContratoService] Erro ao listar Contratos: ${err.message || 'Erro desconhecido'}`, { stack: err.stack });
            throw new AppError(`Erro interno ao listar contratos: ${err.message || 'Erro desconhecido'}`, 500);
        }
    }

    // --- NOVO MÉTODO (CRUD - BUSCAR) ---
    /**
     * Busca um Contrato pelo ID (com todos os dados populados)
     */
    async getById(contratoId: string, empresaId: string): Promise<any> {
        // Não usamos .lean() aqui para que o .toJSON() funcione no generatePDF
        const contrato = await Contrato.findOne({ _id: contratoId, empresaId: empresaId })
            .populate('empresaId') // Popula dados da empresa (para PDF)
            .populate({
                path: 'piId', // Popula a PI completa
                populate: {
                    path: 'clienteId' // Popula o Cliente DENTRO da PI (para PDF)
                }
            });
            
        if (!contrato) {
            throw new AppError('Contrato não encontrado.', 404);
        }
        
        // Validação extra (caso o populate falhe)
        if (!contrato.piId || !contrato.clienteId || !contrato.empresaId) {
             throw new AppError('Dados associados ao contrato (PI, Cliente ou Empresa) não foram encontrados.', 404);
        }
        
        return contrato;
    }

    // --- NOVO MÉTODO (CRUD - ATUALIZAR) ---
    /**
     * Atualiza um Contrato (principalmente o status)
     */
    async update(contratoId: string, updateData: ContratoUpdateData, empresaId: string): Promise<any> {
        
        // --- CORREÇÃO DE SEGURANÇA (MASS ASSIGNMENT) ---
        // Desestruturamos APENAS os campos que o usuário PODE mudar.
        // O único campo mutável de um contrato, após criado, é o status.
        const { status } = updateData;

        const dadosParaAtualizar: Partial<ContratoUpdateData> = { status };

        // Remove campos 'undefined'
        Object.keys(dadosParaAtualizar).forEach(key => {
            const typedKey = key as keyof ContratoUpdateData;
            if (dadosParaAtualizar[typedKey] === undefined) {
                delete dadosParaAtualizar[typedKey];
            }
        });
        
        // Se nenhum dado válido foi enviado, não faz nada.
        if (Object.keys(dadosParaAtualizar).length === 0) {
             throw new AppError('Nenhum dado válido para atualização fornecido.', 400);
        }
        // --- FIM DA CORREÇÃO DE SEGURANÇA ---

        try {
            const contratoAtualizado = await Contrato.findOneAndUpdate(
                { _id: contratoId, empresaId: empresaId },
                { $set: dadosParaAtualizar },
                { new: true, runValidators: true } // 'runValidators' valida o ENUM do status
            )
            .populate('clienteId', 'nome') 
            .populate('piId', 'valorTotal dataInicio dataFim'); // Popula para o retorno

            if (!contratoAtualizado) {
                throw new AppError('Contrato não encontrado.', 404);
            }
            return contratoAtualizado.toJSON();

        } catch (error) {
            if (error instanceof AppError) throw error;
            const err = error as any;
            logger.error(`[ContratoService] Erro ao atualizar contrato ${contratoId}: ${err.message || 'Erro desconhecido'}`, { stack: err.stack });
            throw new AppError(`Erro interno ao atualizar contrato: ${err.message || 'Erro desconhecido'}`, 500);
        }
    }
    
    // --- NOVO MÉTODO (CRUD - DELETAR) ---
    /**
     * Deleta um Contrato (se estiver em 'rascunho')
     */
    async delete(contratoId: string, empresaId: string): Promise<void> {
        try {
            // Regra de Negócio: Só permite deletar contratos em 'rascunho'
            const contrato = await Contrato.findOne({ _id: contratoId, empresaId: empresaId }).lean();
            if (!contrato) {
                 throw new AppError('Contrato não encontrado.', 404);
            }
            if (contrato.status !== 'rascunho') {
                throw new AppError('Não é possível deletar um contrato que já está ativo, concluído ou cancelado.', 400);
            }

            // Deleta o contrato
            await Contrato.deleteOne({ _id: contratoId, empresaId: empresaId });

        } catch (error) {
            if (error instanceof AppError) throw error;
            const err = error as any;
            logger.error(`[ContratoService] Erro ao deletar contrato ${contratoId}: ${err.message || 'Erro desconhecido'}`, { stack: err.stack });
            throw new AppError(`Erro interno ao deletar contrato: ${err.message || 'Erro desconhecido'}`, 500);
        }
    }


    /**
     * Gera e envia o PDF do Contrato
     * (Refatorado para usar o novo método getById)
     */
    async generatePDF(contratoId: string, empresaId: string, res: Response): Promise<void> {
        logger.debug(`[ContratoService] Gerando PDF para Contrato ${contratoId}. Buscando dados...`);
        try {
            // 1. Busca o contrato e todos os dados populados usando o novo método
            const contrato = await this.getById(contratoId, empresaId); 
            
            // As checagens de 'contrato', 'piId', 'clienteId' já são feitas dentro do getById.
            const contratoJson = contrato.toJSON() as any;

            // 2. Chamar o serviço de PDF
            // Usamos .toJSON() pois getById retorna um documento Mongoose completo
            pdfService.generateContrato_PDF(
                res, 
                contratoJson, 
                contratoJson.piId, 
                contratoJson.piId.clienteId, 
                contratoJson.empresaId
            );

        } catch (error) {
            if (error instanceof AppError) throw error;
            const err = error as any;
            logger.error(`[ContratoService] Erro ao gerar PDF do Contrato ${contratoId}: ${err.message || 'Erro desconhecido'}`, { stack: err.stack });
            throw new AppError(`Erro interno ao gerar PDF: ${err.message || 'Erro desconhecido'}`, 500);
        }
    }

    /**
     * Gera e envia o PDF do Contrato (baseado no Excel - NOVO)
     */
    async generatePDFFromExcel(contratoId: string, empresaId: string, res: Response): Promise<void> {
        logger.debug(`[ContratoService] Gerando PDF (via Excel) para Contrato ${contratoId}. Buscando dados...`);
        try {
            // 1. Busca o usuário (para contato/atendimento)
            const user = await User.findOne({ empresa: empresaId, role: 'admin' }).lean();
            const userFallback: any = user || { nome: 'Atendimento', sobrenome: '' };

            // 2. Gera buffer do PDF via PISystemGen (Excel + conversão)
            const buffer = await piGen.generatePDFBufferFromContrato(contratoId, empresaId, userFallback, { timeoutMs: 120000 });

            // 3. Gera nome do arquivo
            const filename = `contrato_${contratoId}.pdf`;

            // 4. Configura headers e envia
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', buffer.length);
            
            res.send(buffer);
            
            logger.info(`[ContratoService] PDF ${filename} gerado com sucesso via Excel`);

        } catch (error) {
            if (error instanceof AppError) throw error;
            const err = error as any;
            logger.error(`[ContratoService] Erro ao gerar PDF do Contrato ${contratoId}: ${err.message || 'Erro desconhecido'}`, { stack: err.stack });
            throw new AppError(`Erro interno ao gerar PDF: ${err.message || 'Erro desconhecido'}`, 500);
        }
    }

    /**
     * Gera e envia o Excel do Contrato
     */
    async generateExcel(contratoId: string, empresaId: string, res: Response): Promise<void> {
        try {
            logger.debug(`[ContratoService] Gerando Excel para Contrato ${contratoId}. Buscando dados...`);

            // 1. Busca o contrato e valida
            const contrato = await Contrato.findOne({ _id: contratoId, empresaId: empresaId })
                .populate('clienteId')
                .populate({
                    path: 'piId',
                    populate: [
                        { path: 'clienteId', select: 'nome endereco cnpj' },
                        { path: 'placas', select: 'numero localizacao' },
                        { path: 'biWeekIds', select: 'name' }
                    ]
                })
                .lean() as any;

            if (!contrato) {
                throw new AppError('Contrato não encontrado.', 404);
            }

            if (!contrato.piId) {
                throw new AppError('PI associada ao contrato não encontrada.', 404);
            }

            // 2. Prepara os dados para o Excel
            const piData = {
                id: contrato.piId._id.toString(),
                cliente: {
                    razaoSocial: contrato.piId.clienteId?.nome || '',
                    endereco: contrato.piId.clienteId?.endereco || '',
                    cnpj: contrato.piId.clienteId?.cnpj || ''
                },
                campanha: {
                    titulo: contrato.piId.titulo || '',
                    produto: contrato.piId.produto || '',
                    periodo: contrato.piId.biWeekIds?.[0]?.name || '',
                    condicoesPagamento: contrato.piId.condicoesPagamento || ''
                },
                placas: contrato.piId.placas?.map((placa: any) => ({
                    numero: placa.numero,
                    localizacao: placa.localizacao
                })) || [],
                financeiro: {
                    valorProducao: contrato.piId.valorProducao || 0,
                    valorVeiculacao: contrato.piId.valorVeiculacao || 0,
                    valorTotal: contrato.piId.valorTotal || 0
                }
            };

            // 3. Carrega o template Excel
            const templatePath = path.join(process.cwd(), 'templates', 'CONTRATO.xlsx');
            await fs.access(templatePath); // Verifica se existe

            const workbook = await XlsxPopulate.fromFileAsync(templatePath);
            const sheet = workbook.sheet(0);

            // 4. Mapeamento das células (AJUSTE estes valores conforme seu Excel)
            const cellMapping = {
                razaoSocial: 'C3',
                endereco: 'C4',
                cnpj: 'C5',
                tituloCampanha: 'B8',
                produto: 'B9',
                periodo: 'B10',
                condicoesPagamento: 'B11',
                descricaoPlacas: 'B13',
                valorProducao: 'F18',
                valorVeiculacao: 'F19',
                valorTotal: 'F20'
            };

            // 5. Preenche os dados
            sheet.cell(cellMapping.razaoSocial).value(piData.cliente.razaoSocial);
            sheet.cell(cellMapping.endereco).value(piData.cliente.endereco);
            sheet.cell(cellMapping.cnpj).value(piData.cliente.cnpj);
            sheet.cell(cellMapping.tituloCampanha).value(piData.campanha.titulo);
            sheet.cell(cellMapping.produto).value(piData.campanha.produto);
            sheet.cell(cellMapping.periodo).value(piData.campanha.periodo);
            sheet.cell(cellMapping.condicoesPagamento).value(piData.campanha.condicoesPagamento);

            // Descrição das placas
            const descricaoPlacas = piData.placas
                .map((placa: any) => `PLACA ${placa.numero}: localizada em ${placa.localizacao}`)
                .join('\n');
            sheet.cell(cellMapping.descricaoPlacas).value(descricaoPlacas);

            // Valores financeiros
            sheet.cell(cellMapping.valorProducao).value(piData.financeiro.valorProducao);
            sheet.cell(cellMapping.valorVeiculacao).value(piData.financeiro.valorVeiculacao);
            sheet.cell(cellMapping.valorTotal).value(piData.financeiro.valorTotal);

            // 6. Gera o buffer do Excel
            const buffer = await workbook.outputAsync();

            // 7. Configura headers para download
            const filename = `CONTRATO_${contratoId}_${piData.cliente.razaoSocial.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', buffer.length);

            res.send(buffer);

            logger.info(`[ContratoService] Excel ${filename} gerado com sucesso`);

        } catch (error) {
            if (error instanceof AppError) throw error;
            const err = error as any;
            logger.error(`[ContratoService] Erro ao gerar Excel do Contrato ${contratoId}: ${err.message || 'Erro desconhecido'}`, { stack: err.stack });
            throw new AppError(`Erro interno ao gerar Excel: ${err.message || 'Erro desconhecido'}`, 500);
        }
    }

    /**
     * Gera PDF a partir do Excel preenchido (NOVO - usando conversor XLSX to PDF)
     */
    async generatePDFFromExcelTemplate(contratoId: string, empresaId: string, res: Response): Promise<void> {
        logger.debug(`[ContratoService] Gerando PDF a partir de Excel para Contrato ${contratoId}`);
        
        try {
            // 1. Busca o contrato completo
            const contrato = await this.getById(contratoId, empresaId) as any;

            // 2. Prepara os dados do contrato
            const piData = {
                cliente: {
                    razaoSocial: contrato.clienteId?.razaoSocial || '',
                    endereco: contrato.clienteId?.endereco || '',
                    cnpj: contrato.clienteId?.cnpj || ''
                },
                campanha: {
                    titulo: contrato.piId?.titulo || '',
                    produto: contrato.piId?.produto || '',
                    periodo: contrato.piId?.biWeekIds?.[0]?.name || '',
                    condicoesPagamento: contrato.piId?.condicoesPagamento || ''
                },
                placas: contrato.piId?.placas?.map((placa: any) => ({
                    numero: placa.numero,
                    localizacao: placa.localizacao
                })) || [],
                financeiro: {
                    valorProducao: contrato.piId?.valorProducao || 0,
                    valorVeiculacao: contrato.piId?.valorVeiculacao || 0,
                    valorTotal: contrato.piId?.valorTotal || 0
                }
            };

            // 3. Carrega o template Excel
            const templatePath = path.join(process.cwd(), 'templates', 'CONTRATO.xlsx');
            await fs.access(templatePath);

            const workbook = await XlsxPopulate.fromFileAsync(templatePath);
            const sheet = workbook.sheet(0);

            // 4. Mapeamento das células
            const cellMapping = {
                razaoSocial: 'C3',
                endereco: 'C4',
                cnpj: 'C5',
                tituloCampanha: 'B8',
                produto: 'B9',
                periodo: 'B10',
                condicoesPagamento: 'B11',
                descricaoPlacas: 'B13',
                valorProducao: 'F18',
                valorVeiculacao: 'F19',
                valorTotal: 'F20'
            };

            // 5. Preenche os dados
            sheet.cell(cellMapping.razaoSocial).value(piData.cliente.razaoSocial);
            sheet.cell(cellMapping.endereco).value(piData.cliente.endereco);
            sheet.cell(cellMapping.cnpj).value(piData.cliente.cnpj);
            sheet.cell(cellMapping.tituloCampanha).value(piData.campanha.titulo);
            sheet.cell(cellMapping.produto).value(piData.campanha.produto);
            sheet.cell(cellMapping.periodo).value(piData.campanha.periodo);
            sheet.cell(cellMapping.condicoesPagamento).value(piData.campanha.condicoesPagamento);

            const descricaoPlacas = piData.placas
                .map((placa: any) => `PLACA ${placa.numero}: localizada em ${placa.localizacao}`)
                .join('\n');
            sheet.cell(cellMapping.descricaoPlacas).value(descricaoPlacas);

            sheet.cell(cellMapping.valorProducao).value(piData.financeiro.valorProducao);
            sheet.cell(cellMapping.valorVeiculacao).value(piData.financeiro.valorVeiculacao);
            sheet.cell(cellMapping.valorTotal).value(piData.financeiro.valorTotal);

            // 6. Gera o buffer do Excel preenchido
            const xlsxBuffer = await workbook.outputAsync();

            // 7. Converte XLSX para PDF usando o conversor
            logger.info(`[ContratoService] Convertendo Excel para PDF...`);
            const pdfBuffer = await xlsxToPdfConverter.convertXlsxBufferToPdf(xlsxBuffer, {
                orientation: 'portrait',
                format: 'A4',
                margin: {
                    top: '1cm',
                    right: '1cm',
                    bottom: '1cm',
                    left: '1cm'
                },
                scale: 0.95
            });

            // 8. Envia o PDF
            const filename = `CONTRATO_${contratoId}_${piData.cliente.razaoSocial.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            res.send(pdfBuffer);

            logger.info(`[ContratoService] PDF ${filename} gerado com sucesso a partir do Excel`);

        } catch (error) {
            if (error instanceof AppError) throw error;
            const err = error as any;
            logger.error(`[ContratoService] Erro ao gerar PDF do Excel: ${err.message || 'Erro desconhecido'}`, { stack: err.stack });
            throw new AppError(`Erro ao gerar PDF do Excel: ${err.message || 'Erro desconhecido'}`, 500);
        }
    }
}

export default ContratoService;

