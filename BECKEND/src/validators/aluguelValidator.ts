import { body, param, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import BiWeek from '@modules/biweeks/BiWeek';
import Empresa from '@modules/empresas/Empresa';
import { PeriodType } from '@utils/periodTypes';
import logger from '@shared/container/logger';

/**
 * [PERÍODO UNIFICADO] Validação para criar aluguel
 * Aceita 3 formatos:
 * 1. Novo formato: { periodType: 'bi-week', biWeekIds: [...] }
 * 2. Novo formato custom: { periodType: 'custom', startDate, endDate }
 * 3. Legado: { bi_week_ids: [...] } ou { data_inicio, data_fim }
 */
export const validateAluguel: ValidationChain[] = [
    body('placa_id')
        .notEmpty()
        .withMessage('ID da placa é obrigatório.')
        .isMongoId()
        .withMessage('ID da placa inválido.'),

    body('cliente_id')
        .notEmpty()
        .withMessage('ID do cliente é obrigatório.')
        .isMongoId()
        .withMessage('ID do cliente inválido.'),

    // [PERÍODO UNIFICADO] Campo novo: periodType
    body('periodType')
        .optional()
        .isIn([PeriodType.BI_WEEK, PeriodType.CUSTOM])
        .withMessage(`periodType deve ser '${PeriodType.BI_WEEK}' ou '${PeriodType.CUSTOM}'.`),

    // [PERÍODO UNIFICADO] Novos campos para bi-week
    body('biWeekIds')
        .optional()
        .isArray({ min: 1 })
        .withMessage('biWeekIds deve ser um array com pelo menos 1 elemento.')
        .custom((value: string[]) => {
            const regex = /^\d{4}-\d{2}$/;
            const allValid = value.every(id => regex.test(id));
            if (!allValid) {
                throw new Error('Formato inválido em biWeekIds. Use YYYY-NN (ex: 2025-01)');
            }
            return true;
        }),

    // [PERÍODO UNIFICADO] Novos campos para custom
    body('startDate')
        .optional()
        .isISO8601()
        .withMessage('startDate inválido (formato YYYY-MM-DD).')
        .toDate(),

    body('endDate')
        .optional()
        .isISO8601()
        .withMessage('endDate inválido (formato YYYY-MM-DD).')
        .toDate()
        .custom((value: Date, { req }: any) => {
            if (req.body.startDate && value <= req.body.startDate) {
                throw new Error('endDate deve ser posterior a startDate.');
            }
            return true;
        }),

    // [LEGADO] Compatibilidade com formato antigo - bi_week_ids
    body('bi_week_ids')
        .optional()
        .isArray({ min: 1 })
        .withMessage('bi_week_ids deve ser um array com pelo menos 1 elemento.')
        .custom((value: string[]) => {
            const regex = /^\d{4}-\d{2}$/;
            const allValid = value.every(id => regex.test(id));
            if (!allValid) {
                throw new Error('Formato inválido em bi_week_ids. Use YYYY-NN (ex: 2025-01)');
            }
            return true;
        }),

    // [LEGADO] Compatibilidade com formato antigo - data_inicio
    body('data_inicio')
        .optional()
        .isISO8601()
        .withMessage('Data de início inválida (formato YYYY-MM-DD).')
        .toDate(),

    // [LEGADO] Compatibilidade com formato antigo - data_fim
    body('data_fim')
        .optional()
        .isISO8601()
        .withMessage('Data final inválida (formato YYYY-MM-DD).')
        .toDate()
        .custom((value: Date, { req }: any) => {
            if (req.body.data_inicio && value <= req.body.data_inicio) {
                throw new Error('A data final deve ser posterior à data inicial.');
            }
            return true;
        }),

    // Validação: Pelo menos um formato de período deve ser fornecido
    body().custom((_value, { req }: any) => {
        const hasNewFormat = req.body.periodType || req.body.biWeekIds || req.body.startDate || req.body.endDate;
        const hasLegacyFormat = req.body.bi_week_ids || (req.body.data_inicio && req.body.data_fim);
        
        if (!hasNewFormat && !hasLegacyFormat) {
            throw new Error('É necessário fornecer informações de período: (periodType + biWeekIds/startDate+endDate) ou (bi_week_ids/data_inicio+data_fim)');
        }
        
        return true;
    })
];

/**
 * Validação ADICIONAL para Bi-Semana (14 dias)
 * Esta validação verifica se as datas do aluguel estão alinhadas com Bi-Semanas cadastradas.
 */
export const validateBiWeekAlignment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void | Response> => {
    try {
        const { data_inicio, data_fim } = req.body;
        
        if (!data_inicio || !data_fim) {
            return next();
        }
        
        const empresaId = (req as any).user.empresaId;
        
        const empresa = await Empresa.findById(empresaId).select('enforce_bi_week_validation').lean();
        
        if (!empresa || !(empresa as any).enforce_bi_week_validation) {
            logger.debug(`[AluguelValidator] Validação de Bi-Semana desabilitada para empresa ${empresaId}.`);
            return next();
        }
        
        logger.info(`[AluguelValidator] Validando alinhamento de Bi-Semana para empresa ${empresaId}.`);
        
        const startDate = data_inicio instanceof Date ? data_inicio : new Date(data_inicio);
        const endDate = data_fim instanceof Date ? data_fim : new Date(data_fim);
        
        const validation = await (BiWeek as any).validatePeriod(startDate, endDate);
        
        if (!validation.valid) {
            logger.warn(`[AluguelValidator] Período não alinhado com Bi-Semanas: ${validation.message}`);
            
            return res.status(400).json({
                success: false,
                message: 'As datas do aluguel devem estar alinhadas com os períodos de Bi-Semana (14 dias) cadastrados.',
                details: validation.message,
                suggestion: validation.suggestion ? {
                    start_date: validation.suggestion.start_date.toISOString().split('T')[0],
                    end_date: validation.suggestion.end_date.toISOString().split('T')[0]
                } : null,
                bi_weeks_found: validation.biWeeks.map((bw: any) => ({
                    bi_week_id: bw.bi_week_id,
                    start_date: bw.start_date.toISOString().split('T')[0],
                    end_date: bw.end_date.toISOString().split('T')[0]
                }))
            });
        }
        
        logger.info(`[AluguelValidator] Período válido: ${validation.message}`);
        
        (req as any).validatedBiWeeks = validation.biWeeks;
        
        next();
        
    } catch (error: any) {
        logger.error(`[AluguelValidator] Erro ao validar Bi-Semana: ${error.message}`, { stack: error.stack });
        next();
    }
};

/**
 * Validação para IDs nos parâmetros da URL
 */
export const validateIdParam: ValidationChain[] = [
    param('id').isMongoId().withMessage('O ID do aluguel fornecido é inválido.')
];

export const validatePlacaIdParam: ValidationChain[] = [
    param('placaId').isMongoId().withMessage('O ID da placa fornecido é inválido.')
];
