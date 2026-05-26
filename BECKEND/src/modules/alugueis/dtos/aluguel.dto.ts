/**
 * Aluguel DTOs & Validation Schemas
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages } from '@shared/validators/validation-messages';

// ============================================
// ZOD SCHEMAS
// ============================================

/**
 * Schema para criação de aluguel
 */
export const CreateAluguelSchema = z.object({
  placaId: z.string()
    .min(1, ValidationMessages.requiredSelect('uma placa')),
  clienteId: z.string()
    .min(1, ValidationMessages.requiredSelect('um cliente')),
  periodType: z.enum(['quinzenal', 'mensal', 'custom'])
    .default('quinzenal'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  biWeekIds: z.array(z.string()).optional(),
  tipo: z.enum(['manual', 'pi']).default('manual'),
  status: z.enum(['ativo', 'finalizado', 'cancelado']).default('ativo'),
  observacoes: z.string()
    .max(1000, ValidationMessages.maxLength('Observações', 1000))
    .optional(),
  pi_code: z.string().optional(),
  proposta_interna: z.string().optional()
}).refine(
  data => data.endDate > data.startDate,
  {
    message: ValidationMessages.startAfterEnd,
    path: ['endDate']
  }
);

/**
 * Schema para atualização de aluguel
 */
export const UpdateAluguelSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  biWeekIds: z.array(z.string()).optional(),
  status: z.enum(['ativo', 'finalizado', 'cancelado']).optional(),
  observacoes: z.string()
    .max(1000, ValidationMessages.maxLength('Observações', 1000))
    .optional()
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  {
    message: ValidationMessages.startAfterEnd,
    path: ['endDate']
  }
);

/**
 * Schema para query de listagem
 */
export const ListAlugueisQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['ativo', 'finalizado', 'cancelado']).optional(),
  placaId: z.string().optional(),
  clienteId: z.string().optional(),
  tipo: z.enum(['manual', 'pi']).optional()
});

/**
 * Schema para verificar disponibilidade
 */
export const CheckDisponibilidadeAluguelSchema = z.object({
  placaId: z.string()
    .min(1, ValidationMessages.requiredSelect('uma placa')),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  excludeAluguelId: z.string().optional()
}).refine(
  data => data.endDate > data.startDate,
  {
    message: ValidationMessages.startAfterEnd,
    path: ['endDate']
  }
);

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CreateAluguelDTO = z.infer<typeof CreateAluguelSchema>;
export type UpdateAluguelDTO = z.infer<typeof UpdateAluguelSchema>;
export type ListAlugueisQueryDTO = z.infer<typeof ListAlugueisQuerySchema>;
export type CheckDisponibilidadeAluguelDTO = z.infer<typeof CheckDisponibilidadeAluguelSchema>;

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Aluguel completo (entidade)
 */
export interface AluguelEntity {
  _id: Types.ObjectId;
  placaId: Types.ObjectId | { _id: Types.ObjectId; numero_placa: string };
  clienteId: Types.ObjectId | { _id: Types.ObjectId; nome: string };
  empresaId: Types.ObjectId;
  periodType: 'quinzenal' | 'mensal' | 'custom';
  startDate: Date;
  endDate: Date;
  biWeekIds?: string[];
  tipo: 'manual' | 'pi';
  status: 'ativo' | 'finalizado' | 'cancelado';
  observacoes?: string;
  pi_code?: string;
  proposta_interna?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aluguel resumido para listagem
 */
export interface AluguelListItem {
  id: string;
  placa_numero: string;
  cliente_nome: string;
  startDate: Date;
  endDate: Date;
  data_inicio?: Date;
  data_fim?: Date;
  status: string;
  tipo: string;
  createdAt: Date;
}

/**
 * Resultado paginado
 */
export interface PaginatedAlugueisResponse {
  data: AluguelListItem[];
  pagination: {
    totalDocs: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Resposta de verificação de disponibilidade
 */
export interface DisponibilidadeAluguelResponse {
  disponivel: boolean;
  conflitos?: Array<{
    aluguelId: string;
    startDate: Date;
    endDate: Date;
    cliente_nome: string;
  }>;
}

// ============================================
// HELPERS DE VALIDAÇÃO
// ============================================

/**
 * Valida dados de criação
 */
export function validateCreateAluguel(data: unknown): CreateAluguelDTO {
  return CreateAluguelSchema.parse(data);
}

/**
 * Valida dados de atualização
 */
export function validateUpdateAluguel(data: unknown): UpdateAluguelDTO {
  return UpdateAluguelSchema.parse(data);
}

/**
 * Valida query de listagem
 */
export function validateListQuery(data: unknown): ListAlugueisQueryDTO {
  return ListAlugueisQuerySchema.parse(data);
}

/**
 * Valida check de disponibilidade
 */
export function validateCheckDisponibilidade(data: unknown): CheckDisponibilidadeAluguelDTO {
  return CheckDisponibilidadeAluguelSchema.parse(data);
}

// ============================================
// TRANSFORMERS
// ============================================

/**
 * Converte AluguelEntity para AluguelListItem
 */
export function toListItem(aluguel: AluguelEntity & any): AluguelListItem {
  const placa = aluguel.placaId;
  const placaNumero = typeof placa === 'object' && placa?.numero_placa 
    ? placa.numero_placa 
    : 'N/A';

  const cliente = aluguel.clienteId;
  const clienteNome = typeof cliente === 'object' && cliente?.nome 
    ? cliente.nome 
    : 'N/A';

  return {
    id: aluguel._id.toString(),
    placa_numero: placaNumero,
    cliente_nome: clienteNome,
    startDate: aluguel.startDate,
    endDate: aluguel.endDate,
    data_inicio: aluguel.startDate || aluguel.data_inicio,
    data_fim: aluguel.endDate || aluguel.data_fim,
    status: aluguel.status,
    tipo: aluguel.tipo,
    createdAt: aluguel.createdAt
  };
}

/**
 * Converte array de AluguelEntity para AluguelListItem[]
 */
export function toListItems(alugueis: Array<AluguelEntity & any>): AluguelListItem[] {
  return alugueis.map(toListItem);
}
