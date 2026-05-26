import { body, ValidationChain } from 'express-validator';
import { validarCNPJ } from '@utils/validators';
import { handleValidationErrors } from '@modules/auth/authValidator';

/**
 * Regras para REGISTAR uma nova empresa e admin
 */
export const registerValidationRules: ValidationChain[] = [
    // Empresa
    body('nome_empresa')
        .trim()
        .notEmpty()
        .withMessage('O nome da empresa é obrigatório.')
        .isLength({ max: 150 })
        .withMessage('Nome da empresa muito longo (máx 150 caracteres).')
        .escape(),

    body('cnpj')
        .notEmpty()
        .withMessage('O CNPJ é obrigatório.')
        .custom((value: string) => {
            if (!validarCNPJ(value)) {
                throw new Error('O CNPJ fornecido é inválido.');
            }
            return true;
        }),

    // Admin User
    body('nome')
        .trim()
        .notEmpty()
        .withMessage('O nome do administrador é obrigatório.')
        .isLength({ max: 100 })
        .withMessage('Nome muito longo (máx 100 caracteres).')
        .escape(),

    body('sobrenome')
        .trim()
        .notEmpty()
        .withMessage('O sobrenome do administrador é obrigatório.')
        .isLength({ max: 100 })
        .withMessage('Sobrenome muito longo (máx 100 caracteres).')
        .escape(),

    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('O nome de utilizador deve ter entre 3 e 50 caracteres.')
        .escape(),

    body('email')
        .isEmail()
        .withMessage('Forneça um e-mail válido.')
        .normalizeEmail()
        .isLength({ max: 100 })
        .withMessage('E-mail muito longo (máx 100 caracteres).'),
        
    body('password')
        .isLength({ min: 6 })
        .withMessage('A senha deve ter no mínimo 6 caracteres.')
];

/**
 * Regras para ATUALIZAR os dados da empresa (Página "Minha Empresa")
 */
export const updateEmpresaRules: ValidationChain[] = [
    body('nome')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('O nome da empresa não pode ficar vazio.')
        .escape(),
    
    body('cnpj')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('O CNPJ não pode ficar vazio.'),
    
    // Validações para os campos de endereço do PDF
    body('endereco')
        .optional()
        .trim()
        .escape(),
    
    body('bairro')
        .optional()
        .trim()
        .escape(),
    
    body('cidade')
        .optional()
        .trim()
        .escape(),
    
    body('telefone')
        .optional()
        .trim()
        .escape()
];

export { handleValidationErrors };
