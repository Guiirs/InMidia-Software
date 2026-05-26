/**
 * User DTOs
 * Schemas de validação com Zod
 */

import { z } from 'zod';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

/**
 * Schema para atualização de perfil de usuário
 */
export const UpdateUserProfileSchema = z.object({
  username: z
    .string()
    .min(3, ValidationMessages.minLength('Username', 3))
    .max(50, ValidationMessages.maxLength('Username', 50))
    .trim()
    .optional(),
  
  email: z
    .string()
    .email(FieldMessages.email.invalid)
    .trim()
    .toLowerCase()
    .optional(),
  
  nome: z
    .string()
    .min(1, ValidationMessages.required('Nome'))
    .max(100, ValidationMessages.maxLength('Nome', 100))
    .trim()
    .optional(),
  
  telefone: z
    .string()
    .trim()
    .optional(),
  
  password: z
    .string()
    .min(6, ValidationMessages.passwordMinLength(6))
    .max(100, ValidationMessages.maxLength('Password', 100))
    .optional(),
}).strict();

// ============================================
// TIPOS
// ============================================

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;

/**
 * Perfil do usuário (resposta)
 */
export interface UserProfileEntity {
  id: string;
  username: string;
  email: string;
  nome: string;
  telefone?: string;
  role: 'user' | 'admin' | 'superadmin';
  ativo: boolean;
  empresa: string; // ID da empresa
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Perfil simplificado (sem dados sensíveis)
 */
export interface UserProfileResponse {
  username: string;
  email: string;
  nome: string;
  telefone?: string;
}

// ============================================
// VALIDATORS
// ============================================

export const validateUpdateUserProfile = (data: unknown): UpdateUserProfileInput => {
  return UpdateUserProfileSchema.parse(data);
};

// ============================================
// TRANSFORMERS
// ============================================

/**
 * Converte documento Mongoose para UserProfileEntity
 */
export const toUserProfileEntity = (doc: any): UserProfileEntity => {
  return {
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    nome: doc.nome,
    telefone: doc.telefone,
    role: doc.role,
    ativo: doc.ativo,
    empresa: doc.empresa?.toString() || doc.empresaId?.toString(),
    lastLogin: doc.lastLogin,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

/**
 * Converte para resposta simplificada (sem campos sensíveis)
 */
export const toUserProfileResponse = (doc: any): UserProfileResponse => {
  return {
    username: doc.username,
    email: doc.email,
    nome: doc.nome,
    telefone: doc.telefone,
  };
};
