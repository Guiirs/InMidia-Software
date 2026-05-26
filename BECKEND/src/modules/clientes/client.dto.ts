/**
 * Client V4.1 DTOs — canonical domain model
 */

import { z } from 'zod';
import { Types } from 'mongoose';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const ClientStatus = {
  ACTIVE:   'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED:  'BLOCKED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ClientStatus = (typeof ClientStatus)[keyof typeof ClientStatus];

export const TipoPessoa = {
  PF: 'PF',
  PJ: 'PJ',
} as const;

export type TipoPessoa = (typeof TipoPessoa)[keyof typeof TipoPessoa];

// ── Zod schemas ────────────────────────────────────────────────────────────────

const documentoSchema = z.string()
  .min(11, 'Documento deve ter pelo menos 11 caracteres (CPF)')
  .max(18, 'Documento muito longo')
  .transform((v) => v.replace(/\D/g, ''));

export const CreateClientSchema = z.object({
  tipoPessoa:   z.enum(['PF', 'PJ']),
  nome:         z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  documento:    documentoSchema,
  nomeFantasia: z.string().max(200).optional().nullable(),
  responsavel:  z.string().max(200).optional().nullable(),
  email:        z.string().email('Email inválido').optional().nullable(),
  telefone:     z.string().max(50).optional().nullable(),
  whatsapp:     z.string().max(50).optional().nullable(),
  endereco:     z.string().max(500).optional().nullable(),
  cidade:       z.string().max(100).optional().nullable(),
  estado:       z.string().length(2, 'Estado deve ter 2 caracteres (UF)').optional().nullable(),
  observacoes:  z.string().max(2000).optional().nullable(),
  tags:         z.array(z.string().max(50)).max(20).optional().default([]),
  metadata:     z.record(z.string(), z.unknown()).optional().default({}),
  status:       z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED']).optional().default('ACTIVE'),
});

export const UpdateClientSchema = CreateClientSchema
  .omit({ tipoPessoa: true, documento: true })
  .extend({
    tipoPessoa: z.enum(['PF', 'PJ']).optional(),
    documento:  documentoSchema.optional(),
    status:     z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  })
  .partial();

export const ListClientsQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  sortBy:     z.enum(['nome', 'createdAt', 'updatedAt', 'status']).default('createdAt'),
  order:      z.enum(['asc', 'desc']).default('desc'),
  status:     z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED']).optional(),
  tipoPessoa: z.enum(['PF', 'PJ']).optional(),
  cidade:     z.string().optional(),
  estado:     z.string().optional(),
  includeArchived: z.coerce.boolean().default(false),
});

export const SearchClientsQuerySchema = z.object({
  q:     z.string().min(2, 'Termo de busca deve ter pelo menos 2 caracteres'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ── Inferred types ─────────────────────────────────────────────────────────────

export type CreateClientDTO    = z.infer<typeof CreateClientSchema>;
export type UpdateClientDTO    = z.infer<typeof UpdateClientSchema>;
export type ListClientsQueryDTO = z.infer<typeof ListClientsQuerySchema>;
export type SearchClientsQueryDTO = z.infer<typeof SearchClientsQuerySchema>;

// ── Response types ─────────────────────────────────────────────────────────────

export interface ClientEntity {
  _id:          Types.ObjectId | string;
  tipoPessoa?:  TipoPessoa;
  nome:         string;
  documento?:   string;
  nomeFantasia?: string;
  responsavel?: string;
  email?:       string;
  telefone?:    string;
  whatsapp?:    string;
  endereco?:    string;
  cidade?:      string;
  estado?:      string;
  observacoes?: string;
  tags?:        string[];
  metadata?:    Record<string, unknown>;
  status:       ClientStatus;
  empresaId:    Types.ObjectId | string;
  createdBy?:   Types.ObjectId | string;
  updatedBy?:   Types.ObjectId | string;
  archivedAt?:  Date;
  archivedBy?:  Types.ObjectId | string;
  createdAt:    Date;
  updatedAt:    Date;
  // derived (not stored)
  contratosCount?: number;
  placasCount?:    number;
}

export interface ClientSummary {
  _id:          string;
  tipoPessoa?:  TipoPessoa;
  nome:         string;
  documento?:   string;
  nomeFantasia?: string;
  responsavel?: string;
  email?:       string;
  telefone?:    string;
  status:       ClientStatus;
  cidade?:      string;
  contratosCount?: number;
}

export interface PaginatedClientsResponse {
  data: ClientSummary[];
  pagination: {
    totalDocs:   number;
    totalPages:  number;
    currentPage: number;
    limit:       number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ClientTimelineEvent {
  id:        string;
  type:      'created' | 'updated' | 'archived' | 'restored' | 'contract' | 'pi';
  label:     string;
  detail?:   string;
  userId?:   string;
  timestamp: Date;
}

// ── Validators ─────────────────────────────────────────────────────────────────

export function validateCreateClient(data: unknown): CreateClientDTO {
  return CreateClientSchema.parse(data);
}

export function validateUpdateClient(data: unknown): UpdateClientDTO {
  return UpdateClientSchema.parse(data);
}

export function validateListClientsQuery(query: unknown): ListClientsQueryDTO {
  return ListClientsQuerySchema.parse(query);
}

export function validateSearchClientsQuery(query: unknown): SearchClientsQueryDTO {
  return SearchClientsQuerySchema.parse(query);
}

// ── Transformer ────────────────────────────────────────────────────────────────

export function toClientSummary(entity: any): ClientSummary {
  return {
    _id:          entity._id?.toString() ?? entity.id,
    tipoPessoa:   entity.tipoPessoa,
    nome:         entity.nome,
    documento:    entity.documento ?? entity.cpfCnpj,
    nomeFantasia: entity.nomeFantasia,
    responsavel:  entity.responsavel,
    email:        entity.email,
    telefone:     entity.telefone,
    status:       entity.status ?? (entity.ativo ? 'ACTIVE' : 'INACTIVE'),
    cidade:       entity.cidade,
    contratosCount: entity.contratosCount,
  };
}

export function toClientEntity(doc: any): ClientEntity {
  return {
    _id:          doc._id?.toString() ?? doc.id,
    tipoPessoa:   doc.tipoPessoa,
    nome:         doc.nome,
    documento:    doc.documento ?? doc.cpfCnpj,
    nomeFantasia: doc.nomeFantasia,
    responsavel:  doc.responsavel,
    email:        doc.email,
    telefone:     doc.telefone,
    whatsapp:     doc.whatsapp,
    endereco:     doc.endereco,
    cidade:       doc.cidade,
    estado:       doc.estado,
    observacoes:  doc.observacoes,
    tags:         doc.tags ?? [],
    metadata:     doc.metadata ?? {},
    status:       doc.status ?? (doc.ativo ? 'ACTIVE' : 'INACTIVE'),
    empresaId:    doc.empresaId?.toString(),
    createdBy:    doc.createdBy?.toString(),
    updatedBy:    doc.updatedBy?.toString(),
    archivedAt:   doc.archivedAt,
    archivedBy:   doc.archivedBy?.toString(),
    createdAt:    doc.createdAt,
    updatedAt:    doc.updatedAt,
  };
}
