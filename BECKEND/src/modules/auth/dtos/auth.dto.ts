/**
 * Auth DTOs - Schemas de validação com Zod
 */

import { z } from 'zod';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

/**
 * Schema para login
 */
export const LoginSchema = z.object({
  usernameOrEmail: z
    .string()
    .min(1, ValidationMessages.required('Username ou email'))
    .trim(),
  
  password: z
    .string()
    .min(1, ValidationMessages.required('Password')),
});

/**
 * Schema para alteração de senha
 */
export const ChangePasswordSchema = z.object({
  oldPassword: z
    .string()
    .min(6, ValidationMessages.passwordMinLength(6)),
  
  newPassword: z
    .string()
    .min(6, ValidationMessages.passwordMinLength(6))
    .max(100, ValidationMessages.maxLength('Nova senha', 100)),
}).refine(
  (data) => data.oldPassword !== data.newPassword,
  {
    message: 'A nova senha não pode ser igual à senha atual',
    path: ['newPassword'],
  }
);

/**
 * Schema para solicitar reset de senha
 */
export const RequestPasswordResetSchema = z.object({
  email: z
    .string()
    .min(1, FieldMessages.email.required)
    .email(FieldMessages.email.invalid)
    .trim()
    .toLowerCase(),
});

/**
 * Schema para resetar senha com token
 */
export const ResetPasswordSchema = z.object({
  token: z
    .string()
    .min(1, ValidationMessages.required('Token')),
  
  newPassword: z
    .string()
    .min(6, ValidationMessages.passwordMinLength(6))
    .max(100, ValidationMessages.maxLength('Nova senha', 100)),
});

// ============================================
// TIPOS
// ============================================

export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

/**
 * Payload do token JWT
 */
export interface JwtPayload {
  id: string;
  empresaId: string;
  role:
    | 'user'
    | 'admin'
    | 'superadmin'
    | 'admin_empresa'
    | 'gestor'
    | 'vendedor'
    | 'financeiro'
    | 'visualizador';
  username: string;
  email: string;
}

/**
 * Resposta de login
 */
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    nome: string;
    telefone?: string;
    role:
      | 'user'
      | 'admin'
      | 'superadmin'
      | 'admin_empresa'
      | 'gestor'
      | 'vendedor'
      | 'financeiro'
      | 'visualizador';
    empresaId: string;
    createdAt: Date;
  };
}

/**
 * Resposta de alteração de senha
 */
export interface ChangePasswordResponse {
  message: string;
}

// ============================================
// VALIDATORS
// ============================================

export const validateLogin = (data: unknown): LoginInput => {
  return LoginSchema.parse(data);
};

export const validateChangePassword = (data: unknown): ChangePasswordInput => {
  return ChangePasswordSchema.parse(data);
};

export const validateRequestPasswordReset = (data: unknown): RequestPasswordResetInput => {
  return RequestPasswordResetSchema.parse(data);
};

export const validateResetPassword = (data: unknown): ResetPasswordInput => {
  return ResetPasswordSchema.parse(data);
};
