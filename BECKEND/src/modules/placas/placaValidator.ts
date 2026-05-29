import { body, query, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { spatialService } from '@modules/spatial';

const commonValidationRules = (requiredNumeroPlaca: boolean): ValidationChain[] => [
    body('numero_placa')
        .if(() => requiredNumeroPlaca)
        .trim()
        .notEmpty()
        .withMessage('O numero da placa e obrigatorio.')
        .isLength({ max: 50 })
        .withMessage('Numero da placa muito longo (max 50 caracteres).')
        .escape(),

    body('numero_placa')
        .if(() => !requiredNumeroPlaca)
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 50 })
        .withMessage('Numero da placa muito longo (max 50 caracteres).')
        .escape(),

    body('coordenadas')
        .optional({ checkFalsy: true })
        .trim()
        .custom((value) => {
            const result = spatialService.validateCoordinates(value);
            if (!result.ok) {
                throw new Error('Formato de coordenadas invalido (ex: -3.12, -38.45).');
            }
            return true;
        })
        .isLength({ max: 100 })
        .withMessage('Coordenadas muito longas (max 100 caracteres).')
        .escape(),

    body('nomeDaRua')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 255 })
        .withMessage('Nome da rua muito longo (max 255 caracteres).')
        .escape(),

    body('tamanho')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 50 })
        .withMessage('Tamanho muito longo (max 50 caracteres).')
        .escape(),

    body('regiaoId')
        .optional({ checkFalsy: true })
        .isMongoId()
        .withMessage('ID da regiao invalido.'),

    body('regiao')
        .optional({ checkFalsy: true })
        .isMongoId()
        .withMessage('ID da regiao invalido.')
];

// Regras de validacao para criar uma placa
export const createPlacaValidationRules: ValidationChain[] = [
    ...commonValidationRules(true),

    body()
        .custom((_value, { req }) => {
            if (!req.body?.regiao && !req.body?.regiaoId && !req.body?.regionId) {
                throw new Error('A regiao e obrigatoria.');
            }
            return true;
        })
];

// Regras de validacao para atualizar uma placa (aceita payload parcial)
export const updatePlacaValidationRules: ValidationChain[] = [
    ...commonValidationRules(false)
];

export const handleValidationErrors = (
    req: Request,
    res: Response,
    next: NextFunction
): void | Response => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    const firstError = errors.array({ onlyFirstError: true })[0]?.msg || 'Erro de validacao';
    return res.status(400).json({ message: firstError });
};

export const disponibilidadeValidationRules: ValidationChain[] = [
    query('dataInicio')
        .optional()
        .isISO8601()
        .withMessage('Data de inicio deve estar no formato ISO8601 (YYYY-MM-DD).')
        .toDate(),
    query('data_inicio')
        .optional()
        .isISO8601()
        .withMessage('Data de inicio deve estar no formato ISO8601 (YYYY-MM-DD).')
        .toDate(),
    query('dataFim')
        .optional()
        .isISO8601()
        .withMessage('Data de fim deve estar no formato ISO8601 (YYYY-MM-DD).')
        .toDate(),
    query('data_fim')
        .optional()
        .isISO8601()
        .withMessage('Data de fim deve estar no formato ISO8601 (YYYY-MM-DD).')
        .toDate()
        .custom((_dataFim: Date, { req }: any) => {
            const dataInicioValue = req.query.dataInicio || req.query.data_inicio;
            const dataFimValue = req.query.dataFim || req.query.data_fim;

            if (!dataInicioValue) {
                throw new Error('A data de inicio e obrigatoria.');
            }

            if (!dataFimValue) {
                throw new Error('A data de fim e obrigatoria.');
            }

            if (dataInicioValue && new Date(dataFimValue) < new Date(dataInicioValue)) {
                throw new Error('A data de fim deve ser posterior ou igual a data de inicio.');
            }
            return true;
        })
];
