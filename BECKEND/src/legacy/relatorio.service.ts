// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
/**
 * Relatorio Service (OLD)
 * DEPRECADO: Use services/relatorio.service.ts
 */

// Modelos e dependências
import Placa from '../placas/Placa';
import Regiao from '../regioes/Regiao';
import Aluguel from '../alugueis/Aluguel';
import Cliente from '../clientes/Cliente';
import mongoose from 'mongoose';
import logger from '../../shared/container/logger';
import AppError from '../../shared/container/AppError';

// [MELHORIA] Importa o PDFKit (já estava no package.json)
import PDFDocument from 'pdfkit'; 
// [MELHORIA] Axios não é mais necessário para esta função
// import axios from 'axios';

// [MELHORIA] Variáveis de ambiente para a API Externa não são mais necessárias
// const PDF_REST_API_KEY = process.env.PDF_REST_API_KEY || '';
// const PDF_REST_ENDPOINT = process.env.PDF_REST_ENDPOINT || 'https://api.pdfrest.com/pdf';


class RelatorioService {
    constructor() {}

    /**
     * [MÉTODO CORRIGIDO - DASHBOARD]
     * Busca o resumo de dados para o dashboard.
     * @param {string} empresa_id - ObjectId da empresa.
     * @returns {Promise<object>} - Objeto com { totalPlacas, placasDisponiveis, regiaoPrincipal }.
     */
    async getDashboardSummary(empresa_id) {
        logger.info(`[RelatorioService] Buscando Dashboard Summary para empresa ${empresa_id}.`);
        try {
            if (!empresa_id || !mongoose.Types.ObjectId.isValid(empresa_id)) {
                throw new AppError('ID da empresa inválido.', 400);
            }
            const empresaObjectId = new mongoose.Types.ObjectId(empresa_id);

            // 1. Contagem total de placas
            const totalPlacasPromise = Placa.countDocuments({ empresaId: empresaObjectId });

            // 2. Contagem de placas disponíveis
            const placasDisponiveisPromise = Placa.countDocuments({
                empresaId: empresaObjectId,
                disponivel: true
            });

            // 3. Região principal (com mais placas)
            const regiaoPrincipalPromise = Placa.aggregate([
                { $match: { empresaId: empresaObjectId } },
                { $group: { _id: '$regiaoId', total: { $sum: 1 } } },
                { $sort: { total: -1 } },
                { $limit: 1 },
                {
                    $lookup: {
                        from: 'regiaos', // Nome da coleção de Regiões
                        localField: '_id',
                        foreignField: '_id',
                        as: 'regiaoDetalhes'
                    }
                },
                { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } },
                { $project: { _id: 0, nome: { $ifNull: ['$regiaoDetalhes.nome', 'N/A'] } } }
            ]);

            const [totalPlacas, placasDisponiveis, regiaoResult] = await Promise.all([
                totalPlacasPromise,
                placasDisponiveisPromise,
                regiaoPrincipalPromise
            ]);

            const regiaoPrincipal = regiaoResult.length > 0 ? regiaoResult[0].nome : 'N/A';

            return { totalPlacas, placasDisponiveis, regiaoPrincipal };

        } catch (error) {
            logger.error(`[RelatorioService] Erro ao gerar Dashboard Summary: ${error.message}`, { stack: error.stack });
            throw new AppError(`Erro interno ao buscar resumo do dashboard: ${error.message}`, 500);
        }
    }

    /**
     * [MÉTODO CORRIGIDO - DASHBOARD]
     * Agrupa a contagem de placas por região.
     * @param {string} empresa_id - ObjectId da empresa.
     * @returns {Promise<Array<object>>} - Array com { regiao, total_placas }.
     */
    async placasPorRegiao(empresa_id) {
        logger.info(`[RelatorioService] Buscando placasPorRegiao para empresa ${empresa_id}.`);
        try {
            if (!empresa_id || !mongoose.Types.ObjectId.isValid(empresa_id)) {
                throw new AppError('ID da empresa inválido.', 400);
            }
            const empresaObjectId = new mongoose.Types.ObjectId(empresa_id);

            const data = await Placa.aggregate([
                { $match: { empresaId: empresaObjectId } },
                { $group: { _id: '$regiaoId', total_placas: { $sum: 1 } } },
                { $sort: { total_placas: -1 } },
                {
                    $lookup: {
                        from: 'regiaos', // Nome da coleção de Regiões
                        localField: '_id',
                        foreignField: '_id',
                        as: 'regiaoDetalhes'
                    }
                },
                { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 0,
                        regiao: { $ifNull: ['$regiaoDetalhes.nome', 'Sem Região'] },
                        total_placas: 1
                    }
                }
            ]);
            return data;
        } catch (error) {
            logger.error(`[RelatorioService] Erro ao buscar placasPorRegiao: ${error.message}`, { stack: error.stack });
            throw new AppError(`Erro interno ao buscar placas por região: ${error.message}`, 500);
        }
    }


    /**
     * Calcula métricas de ocupação de placas em um determinado período.
     * @param {string} empresa_id - ObjectId da empresa.
     * @param {Date} dataInicio - Data de início (Objeto Date).
     * @param {Date} dataFim - Data de fim (Objeto Date).
     * @returns {Promise<object>} - Relatório consolidado.
     */
    async ocupacaoPorPeriodo(empresa_id, dataInicio, dataFim) {
        logger.info(`[RelatorioService] Calculando ocupação para Empresa ${empresa_id} no período: ${dataInicio.toISOString()} a ${dataFim.toISOString()}`);
        
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        
        fim.setDate(fim.getDate() + 1);

        if (isNaN(inicio.getTime()) || isNaN(fim.getTime()) || fim <= inicio) {
            logger.warn(`[RelatorioService] Datas inválidas recebidas: Inicio=${dataInicio}, Fim=${dataFim}`);
            throw new AppError('Datas de relatório inválidas.', 400);
        }
        
        if (!empresa_id || !mongoose.Types.ObjectId.isValid(empresa_id)) {
            throw new AppError('ID da empresa inválido.', 400);
        }
        
        const numDiasPeriodo = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
        const empresaObjectId = new mongoose.Types.ObjectId(empresa_id);

        // --- PIPELINE 1: Ocupação e Placas por Região ---
        const ocupacaoPorRegiao = await Placa.aggregate([
            { 
                $match: { 
                    // [CORREÇÃO]: O modelo Placa não possui 'is_active'. 
                    // A lógica deve ser baseada na existência da placa.
                    empresaId: empresaObjectId 
                } 
            }, 
            {
                $lookup: {
                    from: 'alugueis', 
                    let: { placaId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$$placaId', '$placaId'] },
                                        { $lt: ['$data_inicio', fim] },
                                        { $gt: ['$data_fim', inicio] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'alugueisNoPeriodo'
                }
            },
            {
                $project: {
                    regiao: '$regiaoId',
                    totalAlugueis: { $size: '$alugueisNoPeriodo' },
                    diasAlugados: {
                        $sum: {
                            $map: {
                                input: '$alugueisNoPeriodo',
                                as: 'aluguel',
                                in: {
                                    $let: {
                                        vars: {
                                            effectiveStart: { $max: ['$$aluguel.data_inicio', inicio] },
                                            effectiveEnd: { $min: ['$$aluguel.data_fim', fim] }
                                        },
                                        in: {
                                            $divide: [
                                                { $subtract: ['$$effectiveEnd', '$$effectiveStart'] },
                                                1000 * 60 * 60 * 24
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$regiao',
                    totalPlacas: { $sum: 1 },
                    totalDiasAlugados: { $sum: '$diasAlugados' }
                }
            },
            {
                $lookup: {
                    from: 'regiaos', 
                    localField: '_id',
                    foreignField: '_id',
                    as: 'regiaoDetalhes'
                }
            },
            { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } }, 
            {
                $project: {
                    _id: 0,
                    regiaoId: '$_id',
                    regiao: { $ifNull: ['$regiaoDetalhes.nome', 'Sem Região'] },
                    totalPlacas: 1,
                    totalDiasAlugados: { $round: ['$totalDiasAlugados', 0] },
                    totalDiasPlacas: { $multiply: ['$totalPlacas', numDiasPeriodo] }
                }
            },
            {
                $project: {
                    regiao: 1,
                    totalPlacas: 1,
                    totalDiasAlugados: 1,
                    totalDiasPlacas: 1,
                    taxa_ocupacao_regiao: {
                        $cond: {
                            if: { $eq: ['$totalDiasPlacas', 0] },
                            then: 0,
                            else: { $multiply: [{ $divide: ['$totalDiasAlugados', '$totalDiasPlacas'] }, 100] }
                        }
                    }
                }
            }
        ]);

        // --- CÁLCULOS GLOBAIS ---
        const totalDiasAlugados = ocupacaoPorRegiao.reduce((sum, item) => sum + item.totalDiasAlugados, 0);
        const totalPlacas = ocupacaoPorRegiao.reduce((sum, item) => sum + item.totalPlacas, 0);
        const totalDiasPlacas = totalPlacas * numDiasPeriodo;
        const percentagem = totalDiasPlacas === 0 ? 0 : (totalDiasAlugados / totalDiasPlacas) * 100;
            
        
        // --- PIPELINE 2: Novos Aluguéis por Cliente (Para Gráfico) ---
        const novosAlugueisPorCliente = await Aluguel.aggregate([
             {
                $match: {
                    empresaId: empresaObjectId, 
                    data_inicio: { $gte: inicio, $lt: fim } 
                }
             },
             {
                 $group: {
                     _id: '$clienteId',
                     total_novos_alugueis: { $sum: 1 }
                 }
             },
             { $sort: { total_novos_alugueis: -1 } },
             { $limit: 10 },
             {
                 $lookup: {
                     from: 'clientes', 
                     localField: '_id',
                     foreignField: '_id',
                     as: 'clienteDetalhes'
                 }
             },
             { $unwind: { path: '$clienteDetalhes', preserveNullAndEmptyArrays: true } },
             {
                 $project: {
                     _id: 0,
                     cliente_nome: { $ifNull: ['$clienteDetalhes.nome', 'Cliente Desconhecido'] },
                     total_novos_alugueis: 1
                 }
             }
        ]);
        
        const totalAlugueisNoPeriodo = novosAlugueisPorCliente.reduce((sum, item) => sum + item.total_novos_alugueis, 0);

        return {
            totalDiasPlacas: Math.round(totalDiasPlacas),
            totalDiasAlugados: Math.round(totalDiasAlugados),
            percentagem: parseFloat(percentagem.toFixed(2)),
            totalAlugueisNoPeriodo: totalAlugueisNoPeriodo, 
            ocupacaoPorRegiao: ocupacaoPorRegiao.map(r => ({
                 ...r,
                 taxa_ocupacao_regiao: parseFloat(r.taxa_ocupacao_regiao.toFixed(2)) 
            })),
            novosAlugueisPorCliente: novosAlugueisPorCliente,
        };
    }

    /**
     * [MÉTODO REESCRITO] Gera o PDF do relatório de Ocupação nativamente com PDFKit.
     * @param {object} reportData - O resultado da ocupacaoPorPeriodo (JSON).
     * @param {Date} dataInicio - Início do período (objeto Date).
     * @param {Date} dataFim - Fim do período (objeto Date).
     * @param {object} res - Objeto de resposta do Express.
     * @returns {void}
     */
    async generateOcupacaoPdf(reportData, dataInicio, dataFim, res) {
        logger.info('[RelatorioService] Iniciando geração do PDF de Ocupação (Nativo com PDFKit).');

        // Helper para formatar a data
        const formatPdfDate = (date) => `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
        
        const dataInicioStr = formatPdfDate(dataInicio);
        // Corrige a data final de exibição (pois dataFim foi incrementada em 1 dia no service)
        const dataFimExibicao = new Date(dataFim);
        dataFimExibicao.setUTCDate(dataFimExibicao.getUTCDate() - 1);
        const dataFimStr = formatPdfDate(dataFimExibicao);
        
        const filename = `relatorio_ocupacao_${dataInicio.toISOString().split('T')[0]}_${dataFimExibicao.toISOString().split('T')[0]}.pdf`;

        // --- 1. Configurar Resposta HTTP para PDF ---
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // --- 2. Iniciar Documento PDFKit e "Pipar" (Stream) para a Resposta ---
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        doc.pipe(res);

        // --- 3. Desenhar o Conteúdo do PDF ---
        
        // Cabeçalho Principal
        doc.fontSize(18)
           .fillColor('#D32F2F') // Vermelho (cor do HTML)
           .font('Helvetica-Bold')
           .text('Relatório de Ocupação de Placas', { align: 'center' });
        
        doc.moveDown();

        // Período
        doc.fontSize(12)
           .fillColor('black')
           .font('Helvetica')
           .text(`Período: `, { continued: true })
           .font('Helvetica-Bold')
           .text(`${dataInicioStr} a ${dataFimStr}`);

        doc.moveDown(2);

        // --- Métricas Globais ---
        doc.fontSize(14).font('Helvetica-Bold').text('Métricas Globais');
        doc.moveDown(0.5);

        // Função helper para desenhar métricas
        const drawMetric = (label, value) => {
            doc.fontSize(10).fillColor('#666').font('Helvetica').text(label);
            doc.fontSize(14).fillColor('black').font('Helvetica-Bold').text(value);
            doc.moveDown(0.7);
        };
        
        drawMetric('Taxa de Ocupação Média', `${reportData.percentagem.toFixed(2)}%`);
        drawMetric('Aluguéis Iniciados no Período', `${reportData.totalAlugueisNoPeriodo}`);
        drawMetric('Dias Alugados (Total)', `${reportData.totalDiasAlugados}`);
        drawMetric('Capacidade Máxima (Dias/Placa)', `${reportData.totalDiasPlacas}`);

        doc.moveDown(1);
        
        // --- Tabela 1: Ocupação por Região ---
        doc.fontSize(14).font('Helvetica-Bold').text('Ocupação Detalhada por Região');
        doc.moveDown(0.5);
        
        const tableTopRegiao = doc.y;
        const col1Regiao = 40;
        const col2Regiao = 160;
        const col3Regiao = 260;
        const col4Regiao = 360;
        const col5Regiao = 480;

        // Cabeçalho da Tabela
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Região', col1Regiao, tableTopRegiao);
        doc.text('Placas Ativas', col2Regiao, tableTopRegiao, { width: 80, align: 'right' });
        doc.text('Dias Alugados', col3Regiao, tableTopRegiao, { width: 80, align: 'right' });
        doc.text('Capacidade (Dias)', col4Regiao, tableTopRegiao, { width: 80, align: 'right' });
        doc.text('Taxa Ocupação (%)', col5Regiao, tableTopRegiao, { width: 80, align: 'right' });
        doc.moveDown();
        
        // Linha Divisória
        const tableHeaderBottomY = doc.y;
        doc.strokeColor('#aaaaaa')
           .lineWidth(0.5)
           .moveTo(col1Regiao, tableHeaderBottomY)
           .lineTo(col5Regiao + 80, tableHeaderBottomY)
           .stroke();
           
        // Linhas da Tabela
        doc.font('Helvetica');
        let currentY = doc.y + 5;
        
        reportData.ocupacaoPorRegiao.forEach(r => {
            // Checa se precisa de nova página
            if (currentY > 720) { 
                doc.addPage(); 
                currentY = doc.page.margins.top;
            }
            doc.fontSize(9).text(r.regiao, col1Regiao, currentY, { width: 110, align: 'left' });
            doc.text(r.totalPlacas, col2Regiao, currentY, { width: 80, align: 'right' });
            doc.text(r.totalDiasAlugados, col3Regiao, currentY, { width: 80, align: 'right' });
            doc.text(r.totalDiasPlacas, col4Regiao, currentY, { width: 80, align: 'right' });
            doc.font('Helvetica-Bold').text(`${r.taxa_ocupacao_regiao.toFixed(2)}%`, col5Regiao, currentY, { width: 80, align: 'right' });
            
            doc.font('Helvetica'); // Reseta para fonte normal
            currentY += 15;
        });

        doc.moveDown(2); // Espaço extra

        // --- Tabela 2: Top Clientes ---
        
        // Garante que a nova tabela não comece muito no final da página
        if (doc.y > 650) { 
            doc.addPage();
            doc.y = doc.page.margins.top;
        }
        
        doc.fontSize(14).font('Helvetica-Bold').text('Top 10 Clientes por Novos Aluguéis');
        doc.moveDown(0.5);

        const tableTopCliente = doc.y;
        const col1Cliente = 40;
        const col2Cliente = 480;

        // Cabeçalho
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Cliente', col1Cliente, tableTopCliente);
        doc.text('Total de Novos Aluguéis', col2Cliente, tableTopCliente, { width: 80, align: 'right' });
        doc.moveDown();

        // Linha Divisória
        const tableHeaderBottomY2 = doc.y;
        doc.strokeColor('#aaaaaa')
           .lineWidth(0.5)
           .moveTo(col1Cliente, tableHeaderBottomY2)
           .lineTo(col2Cliente + 80, tableHeaderBottomY2)
           .stroke();
           
        // Linhas
        doc.font('Helvetica');
        currentY = doc.y + 5;

        reportData.novosAlugueisPorCliente.forEach(c => {
             if (currentY > 720) { 
                doc.addPage(); 
                currentY = doc.page.margins.top;
            }
            doc.fontSize(9).text(c.cliente_nome, col1Cliente, currentY, { width: 400, align: 'left' });
            doc.text(c.total_novos_alugueis, col2Cliente, currentY, { width: 80, align: 'right' });
            currentY += 15;
        });


        // --- 4. Finalizar o Documento ---
        doc.end();
        logger.info('[RelatorioService] PDF de Ocupação enviado com sucesso (Nativo).');

        /* // --- CÓDIGO ANTIGO (API EXTERNA) ---
        if (!PDF_REST_API_KEY || !PDF_REST_ENDPOINT) {
             throw new AppError('As variáveis PDF_REST_API_KEY ou PDF_REST_ENDPOINT estão em falta no .env.', 500);
        }
        // ... (geração de HTML) ...
        try {
            const pdfApiEndpoint = `${PDF_REST_ENDPOINT}/html-to-pdf`; 
            const pdfResponse = await axios.post(pdfApiEndpoint, {
                html: htmlContent, ...
            }, { ... });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(Buffer.from(pdfResponse.data));
            logger.info('[RelatorioService] PDF de Ocupação enviado com sucesso via API Externa.');
        } catch (apiError) {
             logger.error(`[RelatorioService] ERRO NA API EXTERNA...`);
             throw new AppError('Falha na comunicação com o serviço de geração de PDF.', 500);
        }
        */
    }
}

export default RelatorioService;
