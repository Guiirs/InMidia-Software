import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO - BI-WEEKS
// ============================================

/**
 * Schema para criar biweek
 */
export const CreateBiWeekSchema = z.object({
  empresaId: z.string().min(1, ValidationMessages.requiredSelect('Empresa')),
  ano: z.number().int().min(2020).max(2100),
  numero: z.number().int().min(1).max(26),
  data_inicio: z.coerce.date(),
  data_fim: z.coerce.date(),
  nome: z.string().optional(),
}).refine(
  (data) => data.data_inicio < data.data_fim,
  { message: ValidationMessages.startAfterEnd }
);

/**
 * Schema para atualizar biweek
 */
export const UpdateBiWeekSchema = z.object({
  nome: z.string().optional(),
  data_inicio: z.coerce.date().optional(),
  data_fim: z.coerce.date().optional(),
  ativo: z.boolean().optional(),
});

/**
 * Schema para gerar biweeks automaticamente
 */
export const GenerateBiWeeksSchema = z.object({
  empresaId: z.string().min(1, ValidationMessages.requiredSelect('Empresa')),
  ano: z.number().int().min(2020).max(2100),
});

/**
 * Schema para listar biweeks
 */
export const ListBiWeeksQuerySchema = z.object({
  empresaId: z.string().optional(),
  ano: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  ativo: z.string().optional().transform(val => val === 'true'),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 26),
});

/**
 * Schema para sincronizar biweeks com aluguéis
 */
export const SyncBiWeeksSchema = z.object({
  empresaId: z.string().min(1, ValidationMessages.requiredSelect('Empresa')),
  ano: z.number().int().min(2020).max(2100),
  forceUpdate: z.boolean().default(false),
});

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type CreateBiWeekInput = z.infer<typeof CreateBiWeekSchema>;
export type UpdateBiWeekInput = z.infer<typeof UpdateBiWeekSchema>;
export type GenerateBiWeeksInput = z.infer<typeof GenerateBiWeeksSchema>;
export type ListBiWeeksQuery = z.infer<typeof ListBiWeeksQuerySchema>;
export type SyncBiWeeksInput = z.infer<typeof SyncBiWeeksSchema>;

/**
 * Entidade BiWeek
 */
export interface BiWeekEntity {
  _id: Types.ObjectId;
  empresaId: Types.ObjectId;
  ano: number;
  numero: number;
  nome: string;
  data_inicio: Date;
  data_fim: Date;
  ativo: boolean;
  totalAlugueis?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resposta paginada de BiWeeks
 */
export interface PaginatedBiWeeksResponse {
  biweeks: BiWeekEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Resultado da geração automática
 */
export interface GenerateBiWeeksResult {
  created: number;
  skipped: number;
  biweeks: BiWeekEntity[];
}

/**
 * Resultado da sincronização
 */
export interface SyncBiWeeksResult {
  processed: number;
  updated: number;
  errors: Array<{
    biweekId: string;
    error: string;
  }>;
}
