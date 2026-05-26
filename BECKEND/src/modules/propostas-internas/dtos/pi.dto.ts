import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

export const PeriodSchema = z.object({
  periodType: z.enum(['BIWEEK', 'CUSTOM', 'MONTHLY']),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  biWeekIds: z.array(z.string()).optional(),
  biWeeks: z.array(z.any()).optional(),
}).refine(
  (data) => data.startDate <= data.endDate,
  { message: ValidationMessages.startAfterEnd }
);

export const CreatePISchema = z.object({
  clienteId: z.string().min(1, ValidationMessages.requiredSelect('Cliente')),
  empresaId: z.string().min(1, ValidationMessages.requiredSelect('Empresa')),
  placaIds: z.array(z.string()).min(1, ValidationMessages.minItems('Placas', 1)),
  period: PeriodSchema,
  valor_mensal: z.number().positive(ValidationMessages.positive('Valor mensal')).optional(),
  desconto: z.number().min(0, ValidationMessages.minValue('Desconto', 0)).max(100, ValidationMessages.maxValue('Desconto', 100)).optional(),
  observacoes: z.string().max(500, FieldMessages.observacoes.max).optional(),
  produtorId: z.string().optional(),
});

export const UpdatePISchema = z.object({
  status: z.enum(['PENDENTE', 'APROVADA', 'REJEITADA', 'ATIVA', 'CANCELADA']).optional(),
  valor_mensal: z.number().positive().optional(),
  desconto: z.number().min(0).max(100).optional(),
  observacoes: z.string().max(500).optional(),
  placaIds: z.array(z.string()).optional(),
  period: PeriodSchema.optional(),
});

export const ListPIsQuerySchema = z.object({
  clienteId: z.string().optional(),
  empresaId: z.string().optional(),
  status: z.enum(['PENDENTE', 'APROVADA', 'REJEITADA', 'ATIVA', 'CANCELADA']).optional(),
  produtorId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
});

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type CreatePIInput = z.infer<typeof CreatePISchema>;
export type UpdatePIInput = z.infer<typeof UpdatePISchema>;
export type ListPIsQuery = z.infer<typeof ListPIsQuerySchema>;
export type Period = z.infer<typeof PeriodSchema>;

export interface PIEntity {
  _id: Types.ObjectId;
  pi_code: string;
  clienteId: Types.ObjectId | {
    _id: Types.ObjectId;
    nome: string;
    email?: string;
  };
  empresaId: Types.ObjectId;
  placaIds: Types.ObjectId[];
  placas?: Array<{
    _id: Types.ObjectId;
    numero_placa: string;
    regiaoId?: Types.ObjectId;
  }>;
  periodType: 'BIWEEK' | 'CUSTOM' | 'MONTHLY';
  startDate: Date;
  endDate: Date;
  biWeekIds?: Types.ObjectId[];
  biWeeks?: any[];
  data_inicio: Date;
  data_fim: Date;
  bi_week_ids?: Types.ObjectId[];
  bi_weeks?: any[];
  valor_mensal?: number;
  valor_total?: number;
  desconto?: number;
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'ATIVA' | 'CANCELADA';
  observacoes?: string;
  produtorId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedPIsResponse {
  pis: PIEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
