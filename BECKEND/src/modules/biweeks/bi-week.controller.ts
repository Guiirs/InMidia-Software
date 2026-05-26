/**
 * BiWeek Controller
 * Endpoints de bi-weeks
 */
// src/modules/biweeks/bi-week.controller.ts
import { Request, Response, NextFunction } from 'express';
import BiWeekService from './bi-week.service';
import logger from '@shared/container/logger';

// Express 5: req.params[x] é string | string[] — cast seguro para route params.
type Params = Record<string, string>;

const biWeekService = new BiWeekService();

/**
 * GET /api/v1/bi-weeks/calendar
 * Retorna o calendário completo de Bi-Semanas com filtros opcionais
 */
export async function getCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    logger.info('[BiWeekController] Requisição para obter calendário de Bi-Semanas.');
    
    try {
        const { ano, ativo } = req.query;
        
        const biWeeks = await biWeekService.getAllBiWeeks({ 
            ano: ano as string | undefined, 
            ativo: ativo as string | boolean | undefined 
        });
        
        res.status(200).json({
            success: true,
            count: biWeeks.length,
            data: biWeeks
        });
        
    } catch (error: any) {
        logger.error(`[BiWeekController] Erro em getCalendar: ${error.message}`, { status: error.status, stack: error.stack });
        next(error);
    }
}

/**
 * GET /api/v1/bi-weeks/years
 * Retorna lista de anos disponíveis no calendário
 */
export async function getYears(_req: Request, res: Response, next: NextFunction): Promise<void> {
    logger.info('[BiWeekController] Requisição para obter anos disponíveis.');
    
    try {
        const years = await biWeekService.getAvailableYears();
        
        res.status(200).json({
            success: true,
            data: years
        });
        
    } catch (error: any) {
        logger.error(`[BiWeekController] Erro em getYears: ${error.message}`, { status: error.status, stack: error.stack });
        next(error);
    }
}

/**
 * GET /api/v1/bi-weeks/:id
 * Retorna uma Bi-Semana específica por ID
 */
export async function getBiWeekById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id } = req.params as Params;
    logger.info(`[BiWeekController] Requisição para obter Bi-Semana ID: ${id}`);
    
    try {
        const biWeek = await biWeekService.getBiWeekById(id!);
        
        res.status(200).json({
            success: true,
            data: biWeek
        });
        
    } catch (error: any) {
        logger.error(`[BiWeekController] Erro em getBiWeekById: ${error.message}`, { status: error.status, stack: error.stack });
        next(error);
    }
}

/**
 * POST /api/v1/bi-weeks
 * Cria uma nova Bi-Semana
 */
export async function createBiWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    logger.info('[BiWeekController] Requisição para criar nova Bi-Semana.');
    
    try {
        const newBiWeek = await biWeekService.createBiWeek(req.body);
        
        res.status(201).json({
            success: true,
            message: 'Bi-Semana criada com sucesso.',
            data: newBiWeek
        });
        
    } catch (error: any) {
        logger.error(`[BiWeekController] Erro em createBiWeek: ${error.message}`, { status: error.status, stack: error.stack });
        next(error);
    }
}

/**
 * PUT /api/v1/bi-weeks/:id
 * Atualiza uma Bi-Semana existente
 */
export async function updateBiWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id } = req.params as Params;
    logger.info(`[BiWeekController] Requisição para atualizar Bi-Semana ID: ${id}`);
    
    try {
        const updatedBiWeek = await biWeekService.updateBiWeek(id!, req.body);
        
        res.status(200).json({
            success: true,
            message: 'Bi-Semana atualizada com sucesso.',
            data: updatedBiWeek
        });
        
    } catch (error: any) {
        logger.error(`[BiWeekController] Erro em updateBiWeek: ${error.message}`, { status: error.status, stack: error.stack });
        next(error);
    }
}

/**
 * DELETE /api/v1/bi-weeks/:id
 * Deleta uma Bi-Semana
 */
export async function deleteBiWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id } = req.params as Params;
    logger.info(`[BiWeekController] Requisição para deletar Bi-Semana ID: ${id}`);
    
    try {
        await biWeekService.deleteBiWeek(id!);
        
        res.status(200).json({
            success: true,
            message: 'Bi-Semana deletada com sucesso.'
        });
        
    } catch (error: any) {
        logger.error(`[BiWeekController] Erro em deleteBiWeek: ${error.message}`, { status: error.status, stack: error.stack });
        next(error);
    }
}

/**
 * POST /api/v1/bi-weeks/generate
 * Gera automaticamente o calendário para um ano
 */
export async function generateCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { ano, overwrite, start_date } = req.body;
    logger.info(`[BiWeekController] Requisição para gerar calendário do ano ${ano}${start_date ? `, com data inicial: ${start_date}` : ''}.`);
    
    try {
        if (!ano) {
            res.status(400).json({
                success: false,
                message: 'O campo "ano" é obrigatório.'
            });
            return;
        }
        
        const result = await biWeekService.generateCalendar(ano, overwrite, start_date);
        
        res.status(201).json({
            success: true,
            ...result
        });
        
    } catch (error: any) {
        logger.error(`[BiWeekController] Erro em generateCalendar: ${error.message}`, { status: error.status, stack: error.stack });
        next(error);
    }
}

/**
 * POST /api/v1/bi-weeks/validate
 * Valida se um período está alinhado com Bi-Semanas
 */
export async function validatePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { start_date, end_date } = req.body;
    logger.info(`[BiWeekController] Requisição para validar período: ${start_date} - ${end_date}`);
    
    try {
        if (!start_date || !end_date) {
            res.status(400).json({
                success: false,
                message: 'Os campos "start_date" e "end_date" são obrigatórios.'
            });
            return;
        }
        
        const validation = await biWeekService.validatePeriod(start_date, end_date);
        
        res.status(200).json({
            success: true,
            ...validation
        });
        
    } catch (error: any) {
        logger.error(`[BiWeekController] Erro em validatePeriod: ${error.message}`, { status: error.status, stack: error.stack });
        next(error);
    }
}

/**
 * GET /api/v1/bi-weeks/find-by-date
 * Busca a Bi-Semana que contém uma data específica
 */
export async function findByDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { date } = req.query;
    logger.info(`[BiWeekController] Requisição para buscar Bi-Semana na data: ${date}`);
    
    try {
        if (!date) {
            res.status(400).json({
                success: false,
                message: 'O parâmetro "date" é obrigatório.'
            });
            return;
        }
        
        const biWeek = await biWeekService.findBiWeekByDate(date as string);
        
        if (!biWeek) {
            res.status(404).json({
                success: false,
                message: 'Nenhuma Bi-Semana encontrada para a data especificada.'
            });
            return;
        }
        
        res.status(200).json({
            success: true,
            data: biWeek
        });
        
    } catch (error: any) {
        logger.error(`[BiWeekController] Erro em findByDate: ${error.message}`, { status: error.status, stack: error.stack });
        next(error);
    }
}

export default {
    getCalendar,
    getYears,
    getBiWeekById,
    createBiWeek,
    updateBiWeek,
    deleteBiWeek,
    generateCalendar,
    validatePeriod,
    findByDate
};

