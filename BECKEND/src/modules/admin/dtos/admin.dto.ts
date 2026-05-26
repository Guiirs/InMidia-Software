import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO - ADMIN
// ============================================

/**
 * Schema para estatísticas do dashboard
 */
export const GetDashboardStatsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  empresaId: z.string().optional(),
});

/**
 * Schema para logs do sistema
 */
export const GetSystemLogsSchema = z.object({
  level: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

/**
 * Schema para cache operations
 */
export const ClearCacheSchema = z.object({
  cacheKey: z.string().optional(),
  pattern: z.string().optional(),
});

/**
 * Schema para operações em lote
 */
export const BulkOperationSchema = z.object({
  operation: z.enum(['DELETE', 'UPDATE', 'ACTIVATE', 'DEACTIVATE']),
  entityType: z.enum(['CLIENTE', 'PLACA', 'ALUGUEL', 'CONTRATO', 'USER']),
  ids: z.array(z.string()).min(1, ValidationMessages.minItems('IDs', 1)),
  data: z.record(z.string(), z.any()).optional(),
});

/**
 * Schema para backup do banco de dados
 */
export const CreateBackupSchema = z.object({
  collections: z.array(z.string()).optional(),
  compress: z.boolean().default(true),
});

/**
 * Schema para restaurar backup
 */
export const RestoreBackupSchema = z.object({
  backupId: z.string().min(1, ValidationMessages.required('ID do backup')),
  collections: z.array(z.string()).optional(),
});

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type GetDashboardStatsQuery = z.infer<typeof GetDashboardStatsSchema>;
export type GetSystemLogsQuery = z.infer<typeof GetSystemLogsSchema>;
export type ClearCacheInput = z.infer<typeof ClearCacheSchema>;
export type BulkOperationInput = z.infer<typeof BulkOperationSchema>;
export type CreateBackupInput = z.infer<typeof CreateBackupSchema>;
export type RestoreBackupInput = z.infer<typeof RestoreBackupSchema>;

/**
 * Estatísticas do dashboard
 */
export interface DashboardStats {
  overview: {
    totalClientes: number;
    totalPlacas: number;
    totalAlugueis: number;
    totalContratos: number;
    totalUsers: number;
  };
  alugueis: {
    ativos: number;
    inativos: number;
    aguardandoAprovacao: number;
    valorTotal: number;
  };
  financeiro: {
    receitaMensal: number;
    receitaAnual: number;
    ticketMedio: number;
  };
  regioes: Array<{
    nome: string;
    totalPlacas: number;
    totalAlugueis: number;
  }>;
  empresas: Array<{
    nome: string;
    totalClientes: number;
    totalAlugueis: number;
    receita: number;
  }>;
}

/**
 * Log do sistema
 */
export interface SystemLog {
  _id: Types.ObjectId;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  userId?: Types.ObjectId;
  ip?: string;
}

/**
 * Informações de cache
 */
export interface CacheInfo {
  keys: string[];
  totalKeys: number;
  memoryUsage?: number;
  hitRate?: number;
}

/**
 * Resultado de operação em lote
 */
export interface BulkOperationResult {
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

/**
 * Informações de backup
 */
export interface BackupInfo {
  _id: Types.ObjectId;
  filename: string;
  size: number;
  collections: string[];
  compressed: boolean;
  createdAt: Date;
  createdBy: Types.ObjectId;
}
