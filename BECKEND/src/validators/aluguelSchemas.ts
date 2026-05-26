import { z } from 'zod';

/**
 * Schema de validação para criar um novo aluguel
 */
export const createAluguelSchema = z.object({
  body: z.object({
    placaId: z.string().min(1, 'ID da placa é obrigatório').regex(/^[0-9a-fA-F]{24}$/, 'ID da placa inválido'),
    clienteId: z.string().min(1, 'ID do cliente é obrigatório').regex(/^[0-9a-fA-F]{24}$/, 'ID do cliente inválido'),
    
    // Period fields (unified system)
    startDate: z.string().datetime({ message: 'Data de início deve ser uma data válida (ISO 8601)' }).optional(),
    endDate: z.string().datetime({ message: 'Data de fim deve ser uma data válida (ISO 8601)' }).optional(),
    periodType: z.enum(['biweek', 'month', 'custom', 'legacy'], {
      message: 'Tipo de período inválido'
    }).optional(),
    biWeekIds: z.array(z.string()).optional(),
    monthYears: z.array(z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mês inválido (YYYY-MM)')).optional(),
    
    // Legacy fields (backward compatibility)
    bi_week_ids: z.array(z.string()).optional(),
    data_inicio: z.string().datetime().optional(),
    data_fim: z.string().datetime().optional(),
    
    // PI integration
    pi_code: z.string().optional(),
    proposta_interna: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID da PI inválido').optional(),
    tipo: z.enum(['manual', 'pi']).default('manual'),
    
    // Status and notes
    status: z.enum(['ativo', 'finalizado', 'cancelado']).default('ativo'),
    observacoes: z.string().trim().max(1000, 'Observações não podem exceder 1000 caracteres').optional(),
  }).refine(
    (data) => {
      // Validação: pelo menos startDate ou data_inicio deve estar presente
      return data.startDate || data.data_inicio || (data.bi_week_ids && data.bi_week_ids.length > 0) || (data.biWeekIds && data.biWeekIds.length > 0);
    },
    {
      message: 'Pelo menos uma definição de período é obrigatória (startDate, data_inicio, biWeekIds ou bi_week_ids)',
      path: ['startDate'],
    }
  ).refine(
    (data) => {
      // Validação: se startDate está presente, endDate também deve estar
      if (data.startDate && !data.endDate) {
        return false;
      }
      return true;
    },
    {
      message: 'Se startDate for fornecido, endDate também é obrigatório',
      path: ['endDate'],
    }
  ).refine(
    (data) => {
      // Validação: endDate deve ser posterior a startDate
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'Data de fim deve ser posterior à data de início',
      path: ['endDate'],
    }
  ),
});

/**
 * Schema de validação para params de rota com placaId
 */
export const getAlugueisByPlacaSchema = z.object({
  params: z.object({
    placaId: z.string().min(1, 'ID da placa é obrigatório').regex(/^[0-9a-fA-F]{24}$/, 'ID da placa inválido'),
  }),
});

/**
 * Schema de validação para params de rota com biWeekId
 */
export const biWeekParamsSchema = z.object({
  params: z.object({
    biWeekId: z.string().min(1, 'ID da bi-semana é obrigatório'),
  }),
});

/**
 * Schema de validação para params de rota com id (aluguel)
 */
export const aluguelIdParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID do aluguel é obrigatório').regex(/^[0-9a-fA-F]{24}$/, 'ID do aluguel inválido'),
  }),
});

/**
 * Type inference para TypeScript
 */
export type CreateAluguelInput = z.infer<typeof createAluguelSchema>['body'];
export type GetAlugueisByPlacaParams = z.infer<typeof getAlugueisByPlacaSchema>['params'];
export type BiWeekParams = z.infer<typeof biWeekParamsSchema>['params'];
export type AluguelIdParams = z.infer<typeof aluguelIdParamsSchema>['params'];
