import { z } from 'zod';

export interface DashboardOverview {
  totalPlacas: number;
  placasDisponiveis: number;
  placasAlugadasOcupadas: number;
  taxaOcupacao: number;
  propostasEmAberto: number;
  contratosAtivos: number;
  receitaEstimadaMensal: number;
  regioesAtivas: number;
}

export interface MostRentedBoard {
  placaId: string;
  placa: string;
  localizacao: string;
  regiao: string;
  quantidadeAlugueisContratos: number;
  receitaGerada: number;
  ultimaLocacao: string | null;
  statusAtual: 'disponivel' | 'ocupada';
}

export interface IdleBoard {
  placaId: string;
  placa: string;
  diasSemAluguel: number | null;
  nuncaAlugada: boolean;
  baixaTaxaOcupacao: boolean;
  taxaOcupacao: number;
  regiao: string;
  status: 'disponivel' | 'ocupada';
  sugestaoAcao: string;
}

export interface RegionPerformance {
  regiaoId: string;
  regiao: string;
  totalPlacas: number;
  placasAlugadas: number;
  taxaOcupacao: number;
  receitaEstimada: number;
  propostasAbertas: number;
  contratosAtivos: number;
}

export interface SalesFunnel {
  propostasCriadas: number;
  propostasEmNegociacao: number;
  propostasAprovadas: number;
  propostasRecusadas: number;
  contratosGerados: number;
  taxaConversao: number;
}

export type DashboardAlertSeverity = 'info' | 'warning' | 'critical';

export interface DashboardAlert {
  id: string;
  tipo:
    | 'high-demand-availability'
    | 'idle-board'
    | 'stale-proposal'
    | 'expiring-contract'
    | 'low-sales-high-availability';
  titulo: string;
  descricao: string;
  severidade: DashboardAlertSeverity;
  acaoSugerida: string;
  meta?: Record<string, unknown>;
}

export const DashboardOverviewSchema = z.object({
  totalPlacas: z.number(),
  placasDisponiveis: z.number(),
  placasAlugadasOcupadas: z.number(),
  taxaOcupacao: z.number(),
  propostasEmAberto: z.number(),
  contratosAtivos: z.number(),
  receitaEstimadaMensal: z.number(),
  regioesAtivas: z.number(),
});

export const MostRentedBoardSchema = z.object({
  placaId: z.string(),
  placa: z.string(),
  localizacao: z.string(),
  regiao: z.string(),
  quantidadeAlugueisContratos: z.number(),
  receitaGerada: z.number(),
  ultimaLocacao: z.string().nullable(),
  statusAtual: z.enum(['disponivel', 'ocupada']),
});

export const IdleBoardSchema = z.object({
  placaId: z.string(),
  placa: z.string(),
  diasSemAluguel: z.number().nullable(),
  nuncaAlugada: z.boolean(),
  baixaTaxaOcupacao: z.boolean(),
  taxaOcupacao: z.number(),
  regiao: z.string(),
  status: z.enum(['disponivel', 'ocupada']),
  sugestaoAcao: z.string(),
});

export const RegionPerformanceSchema = z.object({
  regiaoId: z.string(),
  regiao: z.string(),
  totalPlacas: z.number(),
  placasAlugadas: z.number(),
  taxaOcupacao: z.number(),
  receitaEstimada: z.number(),
  propostasAbertas: z.number(),
  contratosAtivos: z.number(),
});

export const SalesFunnelSchema = z.object({
  propostasCriadas: z.number(),
  propostasEmNegociacao: z.number(),
  propostasAprovadas: z.number(),
  propostasRecusadas: z.number(),
  contratosGerados: z.number(),
  taxaConversao: z.number(),
});

export const DashboardAlertSchema = z.object({
  id: z.string(),
  tipo: z.enum([
    'high-demand-availability',
    'idle-board',
    'stale-proposal',
    'expiring-contract',
    'low-sales-high-availability',
  ]),
  titulo: z.string(),
  descricao: z.string(),
  severidade: z.enum(['info', 'warning', 'critical']),
  acaoSugerida: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
