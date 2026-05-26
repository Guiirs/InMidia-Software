import { z } from 'zod';

export const InventoryEvaluationSchema = z.object({
  placa: z.object({
    _id: z.unknown().optional(),
    id: z.unknown().optional(),
    empresaId: z.unknown().optional(),
    regiaoId: z.unknown().optional(),
    numero_placa: z.string().optional(),
    numeroOperacional: z.number().int().positive().nullable().optional(),
    coordenadas: z.unknown().nullable().optional(),
    disponivel: z.boolean().nullable().optional(),
    ativa: z.boolean().nullable().optional(),
    statusAluguel: z.string().nullable().optional(),
    aluguel_ativo: z.boolean().nullable().optional(),
    aluguel_futuro: z.boolean().nullable().optional(),
  }),
  alugueis: z.array(z.object({
    id: z.string().optional(),
    status: z.string().optional(),
    startDate: z.union([z.date(), z.string()]).nullable().optional(),
    endDate: z.union([z.date(), z.string()]).nullable().optional(),
    placaId: z.unknown().optional(),
  })).optional(),
  contratos: z.array(z.object({
    id: z.string().optional(),
    status: z.string().optional(),
    placaIds: z.array(z.unknown()).optional(),
  })).optional(),
  usedOnMap: z.boolean().optional(),
});

export function validateInventoryEvaluationInput(input: unknown) {
  return InventoryEvaluationSchema.parse(input);
}
