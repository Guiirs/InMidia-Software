/**
 * Empresa DTOs
 * Schemas de validação com Zod
 */

import { z } from 'zod';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

/**
 * Schema para criação de empresa (registro)
 */
export const CreateEmpresaSchema = z.object({
  nome_empresa: z
    .string()
    .min(1, ValidationMessages.required('Nome da empresa'))
    .max(200, ValidationMessages.maxLength('Nome da empresa', 200))
    .trim(),
  
  cnpj: z
    .string()
    .min(14, ValidationMessages.required('CNPJ'))
    .max(18, ValidationMessages.invalidCnpj)
    .trim()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/, ValidationMessages.invalidCnpj),
  
  // Dados do usuário admin
  username: z
    .string()
    .min(3, ValidationMessages.minLength('Username', 3))
    .max(50, ValidationMessages.maxLength('Username', 50))
    .trim(),
  
  email: z
    .string()
    .min(1, FieldMessages.email.required)
    .email(FieldMessages.email.invalid)
    .trim()
    .toLowerCase(),
  
  password: z
    .string()
    .min(8, ValidationMessages.passwordMinLength(8))
    .max(100, ValidationMessages.maxLength('Password', 100)),
  
  nome: z
    .string()
    .min(1, FieldMessages.nome.required)
    .max(100, ValidationMessages.maxLength('Nome', 100))
    .trim(),
  
  sobrenome: z
    .string()
    .min(1, ValidationMessages.required('Sobrenome'))
    .max(100, ValidationMessages.maxLength('Sobrenome', 100))
    .trim(),
});

/**
 * Schema para atualização de empresa
 */
export const UpdateEmpresaSchema = z.object({
  nome: z
    .string()
    .min(1, ValidationMessages.required('Nome da empresa'))
    .max(200, ValidationMessages.maxLength('Nome da empresa', 200))
    .trim()
    .optional(),
  
  telefone: z
    .string()
    .trim()
    .optional(),
  
  email: z
    .string()
    .email(FieldMessages.email.invalid)
    .trim()
    .toLowerCase()
    .optional(),
  
  endereco: z
    .string()
    .trim()
    .optional(),
  
  ativo: z
    .boolean()
    .optional(),
  
  enforce_bi_week_validation: z
    .boolean()
    .optional(),
}).strict(); // Não permite campos extras

// ============================================
// TIPOS
// ============================================

export type CreateEmpresaInput = z.infer<typeof CreateEmpresaSchema>;
export type UpdateEmpresaInput = z.infer<typeof UpdateEmpresaSchema>;

/**
 * Entidade Empresa (resposta)
 */
export interface EmpresaEntity {
  id: string;
  nome: string;
  cnpj: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  ativo: boolean;
  enforce_bi_week_validation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Detalhes da empresa (sem dados sensíveis)
 */
export interface EmpresaDetailsResponse {
  id: string;
  nome: string;
  cnpj: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  ativo: boolean;
  enforce_bi_week_validation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resposta de API Key
 */
export interface ApiKeyResponse {
  apiKey: string;
}

/**
 * Resposta de registro de empresa
 */
export interface RegisterEmpresaResponse {
  empresaId: string;
  userId: string;
}

// ============================================
// VALIDATORS
// ============================================

export const validateCreateEmpresa = (data: unknown): CreateEmpresaInput => {
  return CreateEmpresaSchema.parse(data);
};

export const validateUpdateEmpresa = (data: unknown): UpdateEmpresaInput => {
  return UpdateEmpresaSchema.parse(data);
};

// ============================================
// TRANSFORMERS
// ============================================

/**
 * Converte documento Mongoose para EmpresaEntity
 */
export const toEmpresaEntity = (doc: any): EmpresaEntity => {
  return {
    id: doc._id.toString(),
    nome: doc.nome,
    cnpj: doc.cnpj,
    telefone: doc.telefone,
    email: doc.email,
    endereco: doc.endereco,
    ativo: doc.ativo,
    enforce_bi_week_validation: doc.enforce_bi_week_validation || false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

/**
 * Converte documento para resposta de detalhes (sem API key)
 */
export const toDetailsResponse = (doc: any): EmpresaDetailsResponse => {
  return toEmpresaEntity(doc);
};
