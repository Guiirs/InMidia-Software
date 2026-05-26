/**
 * Relatorio DTOs
 * Schemas de validação para relatórios
 */

import { z } from 'zod';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

/**
 * Schema para query de período
 */
export const PeriodoQuerySchema = z.object({
  dataInicio: z
    .string()
    .min(1, FieldMessages.dataInicio.required)
    .regex(/^\d{4}-\d{2}-\d{2}$/, ValidationMessages.invalidFormat('Data (use YYYY-MM-DD)')),
  
  dataFim: z
    .string()
    .min(1, FieldMessages.dataFim.required)
    .regex(/^\d{4}-\d{2}-\d{2}$/, ValidationMessages.invalidFormat('Data (use YYYY-MM-DD)')),
}).refine(
  (data) => new Date(data.dataInicio) <= new Date(data.dataFim),
  {
    message: ValidationMessages.startAfterEnd,
    path: ['dataFim'],
  }
);

// ============================================
// TIPOS
// ============================================

export type PeriodoQuery = z.infer<typeof PeriodoQuerySchema>;

/**
 * Dashboard Summary
 */
export interface DashboardSummary {
  totalPlacas: number;
  placasDisponiveis: number;
  regiaoPrincipal: string;
}

/**
 * Placas por região
 */
export interface PlacasPorRegiao {
  regiao: string;
  total_placas: number;
}

/**
 * Ocupação por região
 */
export interface OcupacaoPorRegiao {
  regiao: string;
  totalPlacas: number;
  totalDiasAlugados: number;
  totalDiasPlacas: number;
  taxa_ocupacao_regiao: number;
}

/**
 * Aluguéis por cliente
 */
export interface AlugueisPorCliente {
  cliente_nome: string;
  total_novos_alugueis: number;
}

/**
 * Relatório de ocupação
 */
export interface RelatorioOcupacao {
  totalDiasPlacas: number;
  totalDiasAlugados: number;
  percentagem: number;
  totalAlugueisNoPeriodo: number;
  ocupacaoPorRegiao: OcupacaoPorRegiao[];
  novosAlugueisPorCliente: AlugueisPorCliente[];
}

// ============================================
// VALIDATORS
// ============================================

export const validatePeriodoQuery = (data: unknown): PeriodoQuery => {
  return PeriodoQuerySchema.parse(data);
};
