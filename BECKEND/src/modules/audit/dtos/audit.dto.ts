/**
 * Audit DTOs
 * Schemas de validação e tipos para o módulo de auditoria
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages, enumMessage } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

/**
 * Schema para criação de log de auditoria
 */
export const CreateAuditLogSchema = z.object({
  userId: z.string().min(1, ValidationMessages.required('User ID')),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT'], {
    message: enumMessage('Ação', ['CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT']),
  }),
  resource: z.string().min(1, ValidationMessages.required('Resource')),
  resourceId: z.string().min(1, ValidationMessages.required('Resource ID')),
  oldData: z.any().optional(),
  newData: z.any().optional(),
  ip: z.string().optional(),
});

/**
 * Schema para filtros de busca de logs
 */
export const ListAuditLogsQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT']).optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

// ============================================
// TIPOS
// ============================================

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsQuerySchema>;

/**
 * Entidade de AuditLog para retorno
 */
export interface AuditLogEntity {
  _id: Types.ObjectId;
  user: Types.ObjectId | { _id: Types.ObjectId; nome: string; email: string };
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'LOGIN' | 'LOGOUT';
  resource: string;
  resourceId: string;
  changes: {
    old?: any;
    new?: any;
  };
  timestamp: Date;
  ip: string;
}

/**
 * Resposta paginada de logs
 */
export interface PaginatedAuditLogsResponse {
  logs: AuditLogEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
