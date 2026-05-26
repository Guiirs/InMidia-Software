import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO - WEBHOOKS
// ============================================

/**
 * Schema para criar webhook
 */
export const CreateWebhookSchema = z.object({
  empresaId: z.string().min(1, ValidationMessages.requiredSelect('Empresa')),
  url: z.string().url(ValidationMessages.invalidUrl),
  events: z.array(z.enum([
    'CLIENTE_CREATED',
    'CLIENTE_UPDATED',
    'PLACA_CREATED',
    'PLACA_UPDATED',
    'ALUGUEL_CREATED',
    'ALUGUEL_UPDATED',
    'ALUGUEL_DELETED',
    'CONTRATO_CREATED',
    'CONTRATO_UPDATED'
  ])).min(1, ValidationMessages.minItems('Eventos', 1)),
  secret: z.string().min(16, ValidationMessages.minLength('Secret', 16)).optional(),
  active: z.boolean().default(true),
  retryAttempts: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(30000).default(5000),
});

/**
 * Schema para atualizar webhook
 */
export const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  secret: z.string().min(16).optional(),
  active: z.boolean().optional(),
  retryAttempts: z.number().int().min(0).max(10).optional(),
  timeout: z.number().int().min(1000).max(30000).optional(),
});

/**
 * Schema para testar webhook
 */
export const TestWebhookSchema = z.object({
  event: z.enum([
    'CLIENTE_CREATED',
    'CLIENTE_UPDATED',
    'PLACA_CREATED',
    'PLACA_UPDATED',
    'ALUGUEL_CREATED',
    'ALUGUEL_UPDATED'
  ]),
  data: z.record(z.string(), z.any()).optional(),
});

/**
 * Schema para listar webhooks
 */
export const ListWebhooksQuerySchema = z.object({
  empresaId: z.string().optional(),
  active: z.string().optional().transform(val => val === 'true'),
  event: z.string().optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
});

/**
 * Schema para executar webhook
 */
export const ExecuteWebhookSchema = z.object({
  event: z.string().min(1, ValidationMessages.required('Evento')),
  payload: z.record(z.string(), z.any()),
});

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;
export type TestWebhookInput = z.infer<typeof TestWebhookSchema>;
export type ExecuteWebhookInput = z.infer<typeof ExecuteWebhookSchema>;
export type ListWebhooksQuery = z.infer<typeof ListWebhooksQuerySchema>;

/**
 * Entidade Webhook
 */
export interface WebhookEntity {
  _id: Types.ObjectId;
  empresaId: Types.ObjectId;
  empresa?: {
    _id: Types.ObjectId;
    nome: string;
  };
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  retryAttempts: number;
  timeout: number;
  statistics: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    lastCallAt?: Date;
    lastSuccessAt?: Date;
    lastFailureAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Log de execução de webhook
 */
export interface WebhookExecutionLog {
  webhookId: Types.ObjectId | string;
  event: string;
  payload: Record<string, any>;
  status: 'success' | 'failure';
  statusCode?: number;
  response?: {
    status: number;
    body: string;
    headers: Record<string, string>;
  };
  error?: string;
  attempt?: number;
  duration?: number; // em ms
  executedAt: Date;
}

/**
 * Resposta paginada de webhooks
 */
export interface PaginatedWebhooksResponse {
  webhooks: WebhookEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Resultado do teste de webhook
 */
export interface WebhookTestResult {
  success: boolean;
  status?: number;
  response?: string;
  error?: string;
  duration: number;
}
