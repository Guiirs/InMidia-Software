/**
 * Cliente DTOs - Data Transfer Objects
 * Define os contratos de entrada/saída com validação Zod
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';

// ============================================
// SCHEMAS ZOD
// ============================================

/**
 * Schema para criação de cliente
 */
export const CreateClienteSchema = z.object({
  nome: z.string()
    .min(3, FieldMessages.nome.min)
    .max(200, FieldMessages.nome.max),
  
  email: z.string()
    .email(FieldMessages.email.invalid)
    .optional()
    .nullable(),
  
  telefone: z.string()
    .regex(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/, FieldMessages.telefone.invalid)
    .optional()
    .nullable(),
  
  cnpj: z.string()
    .regex(/^\d{14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, FieldMessages.cnpj.invalid)
    .optional()
    .nullable(),
  
  cpf: z.string()
    .regex(/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/, FieldMessages.cpf.invalid)
    .optional()
    .nullable(),
  
  cpfCnpj: z.string()
    .min(11, FieldMessages.cpfCnpj.min)
    .optional()
    .nullable(),
  
  responsavel: z.string()
    .max(200, ValidationMessages.maxLength('Nome do responsável', 200))
    .optional()
    .nullable(),
  
  segmento: z.string()
    .max(100, ValidationMessages.maxLength('Segmento', 100))
    .optional()
    .nullable(),
  
  endereco: z.string()
    .max(500, FieldMessages.endereco.max)
    .optional()
    .nullable(),
  
  cidade: z.string()
    .max(100, FieldMessages.cidade.max)
    .optional()
    .nullable(),
  
  estado: z.string()
    .length(2, FieldMessages.estado.exact)
    .optional()
    .nullable(),
  
  cep: z.string()
    .regex(/^\d{5}-?\d{3}$/, FieldMessages.cep.invalid)
    .optional()
    .nullable(),
  
  ativo: z.boolean()
    .default(true)
});

/**
 * Schema para atualização de cliente (todos os campos opcionais)
 */
export const UpdateClienteSchema = CreateClienteSchema.partial();

/**
 * Schema para query de listagem
 */
export const ListClientesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['nome', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  ativo: z.coerce.boolean().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional()
});

/**
 * Schema para upload de logo
 */
export const ClienteLogoSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'], {
    message: ValidationMessages.invalidFileType(['JPEG', 'JPG', 'PNG', 'GIF', 'WEBP'])
  }),
  size: z.number()
    .max(2 * 1024 * 1024, ValidationMessages.fileTooLarge('2MB')),
  buffer: z.instanceof(Buffer).optional(),
  key: z.string(),
  location: z.string(),
  bucket: z.string()
});

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CreateClienteDTO = z.infer<typeof CreateClienteSchema>;
export type UpdateClienteDTO = z.infer<typeof UpdateClienteSchema>;
export type ListClientesQueryDTO = z.infer<typeof ListClientesQuerySchema>;
export type ClienteLogoDTO = z.infer<typeof ClienteLogoSchema>;

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Cliente completo (entidade)
 */
export interface ClienteEntity {
  _id: Types.ObjectId;
  nome: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  cpf?: string;
  cpfCnpj?: string;
  responsavel?: string;
  segmento?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  ativo: boolean;
  logo?: string;
  logo_url?: string;
  empresaId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cliente para listagem (resumido)
 */
export interface ClienteListItem {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  cpf?: string;
  cidade?: string;
  ativo: boolean;
  logo_url?: string;
}

/**
 * Resultado paginado
 */
export interface PaginatedClientesResponse {
  data: ClienteListItem[];
  pagination: {
    totalDocs: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ============================================
// HELPERS DE VALIDAÇÃO
// ============================================

/**
 * Valida e sanitiza dados de criação
 */
export function validateCreateCliente(data: unknown): CreateClienteDTO {
  return CreateClienteSchema.parse(data);
}

/**
 * Valida e sanitiza dados de atualização
 */
export function validateUpdateCliente(data: unknown): UpdateClienteDTO {
  return UpdateClienteSchema.parse(data);
}

/**
 * Valida query de listagem
 */
export function validateListQuery(query: unknown): ListClientesQueryDTO {
  return ListClientesQuerySchema.parse(query);
}

/**
 * Valida arquivo de logo
 */
export function validateClienteLogo(file: unknown): ClienteLogoDTO {
  return ClienteLogoSchema.parse(file);
}

// ============================================
// TRANSFORMERS
// ============================================

/**
 * Converte entidade para item de lista
 */
export function toListItem(entity: ClienteEntity): ClienteListItem {
  return {
    _id: entity._id.toString(),
    nome: entity.nome,
    email: entity.email,
    telefone: entity.telefone,
    cnpj: entity.cnpj,
    cpf: entity.cpf,
    cidade: entity.cidade,
    ativo: entity.ativo,
    logo_url: entity.logo_url
  };
}

/**
 * Converte array de entidades para lista
 */
export function toListItems(entities: ClienteEntity[]): ClienteListItem[] {
  return entities.map(toListItem);
}
