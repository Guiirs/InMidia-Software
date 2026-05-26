import { body, param, ValidationChain } from 'express-validator';
import { handleValidationErrors } from '@modules/auth/authValidator';
import { PeriodType } from '@utils/periodTypes';

// Validação para o ID na URL
export const validateIdParam: ValidationChain[] = [
    param('id').isMongoId().withMessage('O ID da PI fornecido é inválido.')
];

// Regras de validação para criar ou atualizar uma PI
// [PERÍODO UNIFICADO] Aceita novo formato (periodType, startDate, endDate, biWeekIds) e legado (tipoPeriodo, dataInicio, dataFim)
export const piValidationRules: ValidationChain[] = [
    body('clienteId')
        .notEmpty()
        .withMessage('O cliente é obrigatório.')
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

    // [LEGADO] Compatibilidade: tipoPeriodo
    body('tipoPeriodo')
        .optional()
        .isIn(['quinzenal', 'mensal', 'customizado'])
        .withMessage("tipoPeriodo deve ser 'quinzenal', 'mensal' ou 'customizado'."),

    // [LEGADO] Compatibilidade: dataInicio
    body('dataInicio')
        .optional()
        .isISO8601()
        .withMessage('dataInicio inválida (formato YYYY-MM-DD).')
        .toDate(),

    // [LEGADO] Compatibilidade: dataFim
    body('dataFim')
        .optional()
        .isISO8601()
        .withMessage('dataFim inválida (formato YYYY-MM-DD).')
        .toDate()
        .custom((value: Date, { req }: any) => {
            if (req.body.dataInicio && value <= req.body.dataInicio) {
                throw new Error('A data final deve ser posterior à data inicial.');
            }
            return true;
        }),
    
    body('valorTotal')
        .notEmpty()
        .withMessage('O valor total é obrigatório.')
        .isNumeric()
        .withMessage('O valor total deve ser um número.'),
    
    body('descricao')
        .trim()
        .notEmpty()
        .withMessage('A descrição é obrigatória.')
        .escape(),

    // Validação para a Forma de Pagamento
    body('formaPagamento')
        .optional()
        .trim()
        .escape(),

    // Validação para as Placas
    body('placas')
        .optional()
        .isArray()
        .withMessage('A lista de placas deve ser um array.'),
    
    // Valida cada item dentro do array 'placas'
    body('placas.*')
        .optional()
        .isMongoId()
        .withMessage('Cada ID de placa na lista deve ser um MongoId válido.'),

    // [PERÍODO UNIFICADO] Validação: Pelo menos um formato de período deve ser fornecido
    body().custom((_value, { req }: any) => {
        const hasNewFormat = req.body.periodType || req.body.biWeekIds || req.body.startDate || req.body.endDate;
        const hasLegacyFormat = req.body.tipoPeriodo || req.body.dataInicio || req.body.dataFim;
        
        if (!hasNewFormat && !hasLegacyFormat) {
            throw new Error('É necessário fornecer informações de período: (periodType + biWeekIds/startDate+endDate) ou (tipoPeriodo + dataInicio+dataFim)');
        }
        
        return true;
    })
];

export { handleValidationErrors };
