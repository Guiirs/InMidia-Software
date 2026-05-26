/**
 * Contrato DTOs & Validation Schemas
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages } from '@shared/validators/validation-messages';

// ============================================
// ZOD SCHEMAS
// ============================================

/**
 * Schema para criação de contrato
 */
export const CreateContratoSchema = z.object({
  piId: z.string()
    .min(1, ValidationMessages.required('PI'))
});

/**
 * Schema para atualização de contrato
 */
export const UpdateContratoSchema = z.object({
  status: z.enum(['rascunho', 'ativo', 'concluido', 'cancelado'])
    .optional(),
  numero: z.string()
    .min(1)
    .max(100)
    .optional()
});

/**
 * Schema para query de listagem
 */
export const ListContratosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'numero', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['rascunho', 'ativo', 'concluido', 'cancelado']).optional(),
  clienteId: z.string().optional()
});

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CreateContratoDTO = z.infer<typeof CreateContratoSchema>;
export type UpdateContratoDTO = z.infer<typeof UpdateContratoSchema>;
export type ListContratosQueryDTO = z.infer<typeof ListContratosQuerySchema>;

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Contrato completo (entidade)
 */
export interface ContratoEntity {
  _id: Types.ObjectId;
  empresaId: Types.ObjectId | { _id: Types.ObjectId; nome: string };
  clienteId: Types.ObjectId | { _id: Types.ObjectId; nome: string };
  piId: Types.ObjectId | any;
  numero: string;
  status: 'rascunho' | 'ativo' | 'concluido' | 'cancelado';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contrato resumido para listagem
 */
export interface ContratoListItem {
  id: string;
  numero: string;
  cliente_nome: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resultado paginado
 */
export interface PaginatedContratosResponse {
  data: ContratoListItem[];
  pagination: {
    totalDocs: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ============================================
// HELPERS DE VALIDAÇÃO
// ============================================

/**
 * Valida dados de criação
 */
export function validateCreateContrato(data: unknown): CreateContratoDTO {
  return CreateContratoSchema.parse(data);
}

/**
 * Valida dados de atualização
 */
export function validateUpdateContrato(data: unknown): UpdateContratoDTO {
  return UpdateContratoSchema.parse(data);
}

/**
 * Valida query de listagem
 */
export function validateListQuery(data: unknown): ListContratosQueryDTO {
  return ListContratosQuerySchema.parse(data);
}

// ============================================
// TRANSFORMERS
// ============================================

/**
 * Converte ContratoEntity para ContratoListItem
 */
export function toListItem(contrato: ContratoEntity & any): ContratoListItem {
  const cliente = contrato.clienteId;
  const clienteNome = typeof cliente === 'object' && cliente?.nome 
    ? cliente.nome 
    : 'Cliente não informado';

  return {
    id: contrato._id.toString(),
    numero: contrato.numero,
    cliente_nome: clienteNome,
    status: contrato.status,
    createdAt: contrato.createdAt,
    updatedAt: contrato.updatedAt
  };
}

/**
 * Converte array de ContratoEntity para ContratoListItem[]
 */
export function toListItems(contratos: Array<ContratoEntity & any>): ContratoListItem[] {
  return contratos.map(toListItem);
}
