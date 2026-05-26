// @ts-nocheck
/**
 * Relatorio Controller (OLD)
 * DEPRECADO: Use controllers/relatorio.controller.ts
 */
import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express';
import { validationResult } from 'express-validator';
import RelatorioService from './relatorio.service';
import logger from '../../shared/container/logger';

// Instancia o serviço fora das funções do controller
const relatorioService = new RelatorioService();

/**
 * Controller para obter placas por região.
 * GET /api/v1/relatorios/placas-por-regiao
 */
export async function getPlacasPorRegiao(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = (req.user as any).empresaId;
    const userId = (req.user as any).id;

    logger.info(`[RelatorioController] Utilizador ${userId} requisitou getPlacasPorRegiao para empresa ${empresa_id}.`);

    try {
        const data = await relatorioService.placasPorRegiao(empresa_id);
        logger.info(`[RelatorioController] getPlacasPorRegiao retornou ${data.length} regiões para empresa ${empresa_id}.`);
        res.status(200).json(data);
    } catch (err: any) {
        logger.error(`[RelatorioController] Erro ao chamar relatorioService.placasPorRegiao: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * Controller para gerar o resumo do dashboard.
 * GET /api/v1/relatorios/dashboard-summary
 */
export async function getDashboardSummary(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = (req.user as any).empresaId;
    const userId = (req.user as any).id;

    logger.info(`[RelatorioController] Utilizador ${userId} requisitou getDashboardSummary para empresa ${empresa_id}.`);

    try {
        const summary = await relatorioService.getDashboardSummary(empresa_id);
        logger.info(`[RelatorioController] getDashboardSummary concluído para empresa ${empresa_id}.`);
        res.status(200).json(summary);
    } catch (err: any) {
        logger.error(`[RelatorioController] Erro ao chamar relatorioService.getDashboardSummary: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * Controller para obter a percentagem de ocupação por período.
 * GET /api/v1/relatorios/ocupacao-por-periodo?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
 */
export async function getOcupacaoPorPeriodo(req: Request, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = (req as any).user.empresaId;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const firstError = errors.array({ onlyFirstError: true })[0]?.msg;
        logger.warn(`[RelatorioController] Requisição de Ocupação falhou: Erro de validação: ${firstError}`);
        res.status(400).json({ message: firstError });
        return;
    }

    const dataInicio = new Date(req.query.data_inicio as string);
    const dataFim = new Date(req.query.data_fim as string);

    if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
        res.status(400).json({ message: 'Datas de período inválidas.' });
        return;
    }

    try {
        const reportData = await relatorioService.ocupacaoPorPeriodo(empresa_id, dataInicio, dataFim);
        res.status(200).json(reportData);
    } catch (err: any) {
        logger.error(`[RelatorioController] Erro ao obter ocupação por período: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * Controller para gerar e exportar o relatório de ocupação como PDF via API Externa.
 * GET /api/v1/relatorios/export/ocupacao-por-periodo?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
 */
export async function exportOcupacaoPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    const empresa_id = (req as any).user.empresaId;
    const userId = (req as any).user.id;

    logger.info(`[RelatorioController] Utilizador ${userId} requisitou exportação PDF de Ocupação.`);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstError = errors.array({ onlyFirstError: true })[0]?.msg;
        res.status(400).json({ message: firstError });
        return;
    }

    const dataInicio = new Date(req.query.data_inicio as string);
    const dataFim = new Date(req.query.data_fim as string);

    if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
        res.status(400).json({ message: 'Datas de período inválidas.' });
        return;
    }

    try {
        const reportData = await relatorioService.ocupacaoPorPeriodo(empresa_id, dataInicio, dataFim);

        await relatorioService.generateOcupacaoPdf(reportData, dataInicio, dataFim, res);
    } catch (err: any) {
        logger.error(`[RelatorioController] Erro ao exportar PDF: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

export default {
    getPlacasPorRegiao,
    getDashboardSummary,
    getOcupacaoPorPeriodo,
    exportOcupacaoPdf
};

