import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS DE VALIDAÇÃO - PUBLIC API
// ============================================

/**
 * Schema para consulta pública de placa
 */
export const PublicPlacaQuerySchema = z.object({
  numero_placa: z.string().min(1, ValidationMessages.required('Número da placa')).transform(val => val.toUpperCase()),
  api_key: z.string().min(1, ValidationMessages.required('API Key')),
});

/**
 * Schema para registro público de empresa
 */
export const PublicRegisterEmpresaSchema = z.object({
  nome: z.string().min(3, ValidationMessages.minLength('Nome', 3)),
  cnpj: z.string().regex(/^\d{14}$/, ValidationMessages.invalidCnpj),
  email: z.string().email(ValidationMessages.invalidEmail),
  telefone: z.string().regex(/^\d{10,11}$/, ValidationMessages.invalidPhone),
  endereco: z.object({
    rua: z.string().min(1),
    numero: z.string().min(1),
    bairro: z.string().min(1),
    cidade: z.string().min(1),
    estado: z.string().length(2),
    cep: z.string().regex(/^\d{8}$/, ValidationMessages.invalidCep),
  }),
  responsavel: z.object({
    nome: z.string().min(3),
    email: z.string().email(),
    telefone: z.string().regex(/^\d{10,11}$/),
  }),
});

/**
 * Schema para consulta de disponibilidade
 */
export const PublicCheckAvailabilitySchema = z.object({
  regiaoId: z.string().min(1, ValidationMessages.requiredSelect('Região')),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  api_key: z.string().min(1, ValidationMessages.required('API Key')),
}).refine(
  (data) => data.startDate < data.endDate,
  { message: ValidationMessages.startAfterEnd }
);

/**
 * Schema para webhook callback
 */
export const PublicWebhookSchema = z.object({
  event: z.enum(['ALUGUEL_CREATED', 'ALUGUEL_UPDATED', 'PLACA_STATUS_CHANGED']),
  data: z.record(z.string(), z.any()),
  timestamp: z.coerce.date(),
  signature: z.string().min(1),
});

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type PublicPlacaQuery = z.infer<typeof PublicPlacaQuerySchema>;
export type PublicRegisterEmpresaInput = z.infer<typeof PublicRegisterEmpresaSchema>;
export type PublicCheckAvailabilityInput = z.infer<typeof PublicCheckAvailabilitySchema>;
export type PublicWebhookInput = z.infer<typeof PublicWebhookSchema>;

/**
 * Resposta pública de placa
 */
export interface PublicPlacaResponse {
  placa: {
    numero_placa: string;
    regiaoId: string;
    regiao: {
      nome: string;
      cidade: string;
      estado: string;
    };
    disponivel: boolean;
    aluguelAtivo?: {
      data_inicio: Date;
      data_fim: Date;
      cliente: string; // Nome ocultado parcialmente
    };
  };
}

/**
 * Resposta de disponibilidade
 */
export interface AvailabilityResponse {
  disponivel: boolean;
  placasDisponiveis: number;
  placasTotais: number;
  periodo: {
    inicio: Date;
    fim: Date;
  };
}

/**
 * API Key info
 */
export interface ApiKeyInfo {
  _id: Types.ObjectId;
  key: string;
  empresaId: Types.ObjectId;
  empresa?: {
    nome: string;
    cnpj: string;
  };
  permissions: string[];
  rateLimit: {
    requests: number;
    period: number; // em segundos
  };
  active: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

// ============================================
// SCHEMAS E TIPOS ADICIONAIS PARA REPOSITORY
// ============================================

/**
 * Schema para registrar placa via API pública
 */
export const RegisterPlacaSchema = z.object({
  placa: z.string().min(7).max(7, 'Placa deve ter 7 caracteres').transform(val => val.toUpperCase()),
  localizacao: z.string().optional(),
  observacoes: z.string().optional(),
});

export type RegisterPlacaInput = z.infer<typeof RegisterPlacaSchema>;

/**
 * Interface para informações públicas de uma placa
 */
export interface PublicPlacaInfo {
  placa: string;
  status: string;
  localizacao: string;
  ultimaAtualizacao: Date;
  cliente: {
    nome: string;
    email: string;
    telefone: string;
  } | null;
}
