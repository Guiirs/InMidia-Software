/**
 * Regiao DTOs & Validation Schemas
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

// ============================================
// ZOD SCHEMAS
// ============================================

/**
 * Schema para criação de região
 */
export const CreateRegiaoSchema = z.object({
  nome: z.string()
    .min(1, FieldMessages.nome.required)
    .max(100, ValidationMessages.maxLength('Nome', 100))
    .trim(),
  codigo: z.string()
    .min(1, ValidationMessages.required('Código'))
    .max(20, ValidationMessages.maxLength('Código', 20))
    .trim()
    .toUpperCase(),
  descricao: z.string()
    .max(500, FieldMessages.descricao.max)
    .optional(),
  ativo: z.boolean().default(true)
});

/**
 * Schema para atualização de região
 */
export const UpdateRegiaoSchema = z.object({
  nome: z.string()
    .min(1, FieldMessages.nome.required)
    .max(100, ValidationMessages.maxLength('Nome', 100))
    .trim()
    .optional(),
  codigo: z.string()
    .min(1, ValidationMessages.required('Código'))
    .max(20, ValidationMessages.maxLength('Código', 20))
    .trim()
    .toUpperCase()
    .optional(),
  descricao: z.string()
    .max(500, FieldMessages.descricao.max)
    .optional(),
  ativo: z.boolean().optional()
});

/**
 * Schema para query de listagem
 */
export const ListRegioesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // max aumentado de 100 → 500 (ARCH-2) para suportar empresas com muitas regiões.
  // default aumentado de 50 → 100 para evitar dropdowns truncados.
  limit: z.coerce.number().int().min(1).max(500).default(100),
  sortBy: z.enum(['nome', 'codigo', 'createdAt']).default('nome'),
  order: z.enum(['asc', 'desc']).default('asc'),
  ativo: z.coerce.boolean().optional(),
  search: z.string().optional()
});

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CreateRegiaoDTO = z.infer<typeof CreateRegiaoSchema>;
export type UpdateRegiaoDTO = z.infer<typeof UpdateRegiaoSchema>;
export type ListRegioesQueryDTO = z.infer<typeof ListRegioesQuerySchema>;

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Região completa (entidade)
 */
export interface RegiaoEntity {
  _id: Types.ObjectId;
  nome: string;
  codigo: string;
  descricao?: string;
  ativo: boolean;
  empresaId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Região resumida para listagem
 */
export interface RegiaoListItem {
  id: string;
  nome: string;
  codigo: string;
  ativo: boolean;
  placasCount?: number;
  createdAt: Date;
}

/**
 * Resultado paginado
 */
export interface PaginatedRegioesResponse {
  data: RegiaoListItem[];
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
export function validateCreateRegiao(data: unknown): CreateRegiaoDTO {
  return CreateRegiaoSchema.parse(data);
}

/**
 * Valida dados de atualização
 */
export function validateUpdateRegiao(data: unknown): UpdateRegiaoDTO {
  return UpdateRegiaoSchema.parse(data);
}

/**
 * Valida query de listagem
 */
export function validateListQuery(data: unknown): ListRegioesQueryDTO {
  return ListRegioesQuerySchema.parse(data);
}

// ============================================
// TRANSFORMERS
// ============================================

/**
 * Converte RegiaoEntity para RegiaoListItem
 */
export function toListItem(regiao: RegiaoEntity & { placasCount?: number }): RegiaoListItem {
  return {
    id: regiao._id.toString(),
    nome: regiao.nome,
    codigo: regiao.codigo,
    ativo: regiao.ativo,
    placasCount: regiao.placasCount,
    createdAt: regiao.createdAt
  };
}

/**
 * Converte array de RegiaoEntity para RegiaoListItem[]
 */
export function toListItems(regioes: Array<RegiaoEntity & { placasCount?: number }>): RegiaoListItem[] {
  return regioes.map(toListItem);
}
