import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO - WHATSAPP
// ============================================

/**
 * Schema para enviar mensagem
 */
export const SendWhatsAppMessageSchema = z.object({
  to: z.string().regex(/^\d{10,15}$/, ValidationMessages.invalidPhone),
  message: z.string().min(1, ValidationMessages.required('Mensagem')).max(4096, ValidationMessages.maxLength('Mensagem', 4096)),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
});

/**
 * Schema para enviar mensagem em lote
 */
export const SendBulkWhatsAppSchema = z.object({
  recipients: z.array(z.object({
    to: z.string().regex(/^\d{10,15}$/),
    message: z.string().min(1).max(4096),
    variables: z.record(z.string(), z.string()).optional(),
  })).min(1, ValidationMessages.minItems('Destinatários', 1)).max(100, ValidationMessages.maxItems('Destinatários', 100)),
  templateId: z.string().optional(),
});

/**
 * Schema para criar template
 */
export const CreateWhatsAppTemplateSchema = z.object({
  name: z.string().min(1, ValidationMessages.required('Nome')),
  message: z.string().min(1, ValidationMessages.required('Mensagem')),
  variables: z.array(z.string()).optional(),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('UTILITY'),
});

/**
 * Schema para webhook do WhatsApp
 */
export const WhatsAppWebhookSchema = z.object({
  from: z.string(),
  message: z.string(),
  timestamp: z.coerce.date(),
  messageId: z.string(),
  status: z.enum(['SENT', 'DELIVERED', 'READ', 'FAILED']).optional(),
});

/**
 * Schema para listar mensagens
 */
export const ListWhatsAppMessagesQuerySchema = z.object({
  to: z.string().optional(),
  status: z.enum(['SENT', 'DELIVERED', 'READ', 'FAILED', 'PENDING']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type SendWhatsAppMessageInput = z.infer<typeof SendWhatsAppMessageSchema>;
export type SendBulkWhatsAppInput = z.infer<typeof SendBulkWhatsAppSchema>;
export type CreateWhatsAppTemplateInput = z.infer<typeof CreateWhatsAppTemplateSchema>;
export type WhatsAppWebhookInput = z.infer<typeof WhatsAppWebhookSchema>;
export type ListWhatsAppMessagesQuery = z.infer<typeof ListWhatsAppMessagesQuerySchema>;

// Aliases para compatibilidade com repositories/services
export const SendMessageSchema = SendWhatsAppMessageSchema;
export const SendBulkMessagesSchema = SendBulkWhatsAppSchema;
export const CreateTemplateSchema = CreateWhatsAppTemplateSchema;
export const UpdateTemplateSchema = z.object({
  name: z.string().optional(),
  message: z.string().optional(),
  variables: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});
export const ListTemplatesQuerySchema = z.object({
  active: z.string().optional().transform(val => val === 'true'),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type SendBulkMessagesInput = z.infer<typeof SendBulkMessagesSchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
export type ListTemplatesQuery = z.infer<typeof ListTemplatesQuerySchema>;

/**
 * Entidade WhatsApp Message
 */
export interface WhatsAppMessageEntity {
  _id: Types.ObjectId;
  to: string;
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'PENDING';
  externalId?: string;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Alias para compatibilidade
export type MessageEntity = {
  _id: any;
  to: string;
  message: string;
  templateId?: string;
  status: string;
  sentAt: Date;
};

/**
 * Template de mensagem
 */
export interface WhatsAppTemplateEntity {
  _id: Types.ObjectId;
  name: string;
  message: string;
  variables: string[];
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  approved: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Alias para compatibilidade
export type TemplateEntity = {
  _id: any;
  name: string;
  content: string;
  variables: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Resposta paginada de mensagens
 */
export interface PaginatedWhatsAppMessagesResponse {
  messages: WhatsAppMessageEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Alias para compatibilidade
export type PaginatedTemplatesResponse = {
  data: TemplateEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/**
 * Status da sessão do WhatsApp
 */
export interface WhatsAppSessionStatus {
  connected: boolean;
  phoneNumber?: string;
  qrCode?: string;
  lastSeen?: Date;
}

/**
 * Resultado do envio em lote
 */
export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    to: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
  messages?: MessageEntity[];
  errors?: Array<{
    recipient: string;
    error: string;
  }>;
}
