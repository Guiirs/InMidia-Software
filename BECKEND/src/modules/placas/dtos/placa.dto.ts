/**
 * Placa DTOs & Validation Schemas
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages, FieldMessages } from '@shared/validators/validation-messages';
import { GeoPointInputSchema } from '@modules/spatial';
import { PlateImageCategoryValues } from '@database/schemas/placa.schema';

const LEGACY_COMMERCIAL_PLATE_FIELDS = [
  'cliente',
  'clienteId',
  'cliente_id',
  'contrato',
  'contratoId',
  'contrato_id',
  'aluguel',
  'aluguelId',
  'aluguel_id',
  'valor',
  'valor_mensal',
  'valorMensal',
  'valorContratacao',
  'periodo',
  'period',
  'dataInicio',
  'data_inicio',
  'startDate',
  'dataFim',
  'data_fim',
  'endDate',
] as const;

function stripCommercialPlateFields(data: unknown): Record<string, any> {
  const normalized = { ...(data as any) };
  LEGACY_COMMERCIAL_PLATE_FIELDS.forEach((field) => {
    delete normalized[field];
  });
  return normalized;
}

// ============================================
// ZOD SCHEMAS
// ============================================

/**
 * Schema base da placa.
 * Campo canônico de disponibilidade: `disponivel`.
 * Campo canônico de endereço: `endereco`.
 * O alias `ativa` e `nomeDaRua` são aceitos na borda da API e normalizados.
 */
const PlacaBaseSchema = z.object({
  numero_placa: z.string()
    .min(1, FieldMessages.numeroPlaca.required)
    .max(50, FieldMessages.numeroPlaca.max)
    .trim(),

  numeroOperacional: z.number()
    .int()
    .positive('Número operacional deve ser maior que zero')
    .optional(),

  // ── Endereço ────────────────────────────────────────────────────────────
  /** Campo canônico de endereço. */
  endereco: z.string()
    .min(1, 'Endereço não pode ser vazio')
    .max(500, ValidationMessages.maxLength('Endereço', 500))
    .trim()
    .optional(),

  /** @deprecated Use endereco. Aceito por compatibilidade. */
  nomeDaRua: z.string()
    .max(500, ValidationMessages.maxLength('Localização', 500))
    .optional()
    .nullable(),

  /** @deprecated Use endereco. */
  localizacao: z.string()
    .max(500, ValidationMessages.maxLength('Localização', 500))
    .optional()
    .nullable(),

  latitude: z.number()
    .min(-90, 'Latitude deve estar entre -90 e 90')
    .max(90, 'Latitude deve estar entre -90 e 90')
    .optional()
    .nullable(),

  longitude: z.number()
    .min(-180, 'Longitude deve estar entre -180 e 180')
    .max(180, 'Longitude deve estar entre -180 e 180')
    .optional()
    .nullable(),

  /** @deprecated Use latitude/longitude. */
  coordenadas: GeoPointInputSchema.optional().nullable(),

  // ── Região ────────────────────────────────────────────────────────────
  regiaoId: z.string()
    .min(1, FieldMessages.regiao.required)
    .optional(),

  regionId: z.string()
    .min(1, FieldMessages.regiao.required)
    .optional(),

  regionalLot: z.string()
    .max(100, ValidationMessages.maxLength('Lote regional', 100))
    .optional()
    .nullable(),

  loteRegional: z.string()
    .max(100, ValidationMessages.maxLength('Lote regional', 100))
    .optional()
    .nullable(),

  // ── Tipo e dimensões ────────────────────────────────────────────────────
  tipo: z.enum(['busdoor', 'backbus', 'frontbus', 'empena', 'painel', 'outdoor', 'totem', 'outro'])
    .optional(),

  largura: z.number()
    .positive(ValidationMessages.positive('Largura'))
    .optional()
    .nullable(),

  altura: z.number()
    .positive(ValidationMessages.positive('Altura'))
    .optional()
    .nullable(),

  // ── Status ────────────────────────────────────────────────────────────
  disponivel: z.boolean().default(true),
  /** @deprecated Alias legado — normalizado para `disponivel`. */
  ativa: z.boolean().optional(),

  statusOperacional: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ARCHIVED']).optional(),
  statusComercial: z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'UNAVAILABLE']).optional(),

  // ── Observações ───────────────────────────────────────────────────────
  notes: z.string()
    .max(2000, ValidationMessages.maxLength('Observações', 2000))
    .optional()
    .nullable(),

  /** @deprecated Use notes. */
  observacoes: z.string()
    .max(1000, FieldMessages.observacoes.max)
    .optional()
    .nullable(),
});

export const CreatePlacaSchema = PlacaBaseSchema.superRefine((data, ctx) => {
  if (!data.regiaoId && !data.regionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['regionId'],
      message: FieldMessages.regiao.required,
    });
  }
  // Latitude e longitude devem ser informados juntos
  if ((data.latitude !== undefined && data.latitude !== null) !== (data.longitude !== undefined && data.longitude !== null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['longitude'],
      message: 'Latitude e longitude devem ser informados juntos',
    });
  }
});

export const UpdatePlacaSchema = PlacaBaseSchema.partial().superRefine((data, ctx) => {
  if (
    (data.latitude !== undefined && data.latitude !== null) !==
    (data.longitude !== undefined && data.longitude !== null)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['longitude'],
      message: 'Latitude e longitude devem ser informados juntos',
    });
  }
});

export const ListPlacasQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
  sortBy: z.enum(['numeroOperacional', 'numero_placa', 'createdAt', 'valor_mensal', 'tipo']).default('numero_placa'),
  order: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
  regiaoId: z.string().optional(),
  tipo: z.enum(['busdoor', 'backbus', 'frontbus', 'empena', 'painel', 'outdoor', 'totem', 'outro']).optional(),
  ativa: z.coerce.boolean().optional(),
  disponivel: z.coerce.boolean().optional(),
  statusOperacional: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ARCHIVED']).optional(),
  statusComercial: z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'UNAVAILABLE']).optional(),
  includeArchived: z.coerce.boolean().default(false),
});

export const PlacaImageSchema = z.object({
  mimetype: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']),
  size: z.number()
    .max(5 * 1024 * 1024, 'Arquivo muito grande. Tamanho máximo: 5MB'),
  filename: z.string(),
});

/** Schema para upload de imagem adicional (POST /plates/:id/images) */
export const UploadPlateImageSchema = z.object({
  category: z.enum(PlateImageCategoryValues).default('OTHER'),
  setAsMain: z.coerce.boolean().default(false),
  source: z.enum(['UPLOAD', 'GENERATED', 'IMPORTED']).default('UPLOAD'),
  generatedBy: z.string().max(120).optional(),
  templateId: z.string().max(120).optional(),
  generationSource: z.string().max(120).optional(),
  overlayData: z.unknown().optional(),
  version: z.coerce.number().int().min(1).default(1),
});

export const CheckDisponibilidadeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  placaId: z.string().optional(),
}).refine((data) => data.endDate > data.startDate, {
  message: 'Data de fim deve ser posterior à data de início',
  path: ['endDate'],
});

export const ReorderPlacasSchema = z.object({
  items: z.array(z.object({
    placaId: z.string().min(1, 'Placa inválida'),
    numeroOperacional: z.number().int().min(1, 'Número operacional deve ser maior que zero'),
  }))
  .min(1, 'Informe ao menos uma placa para organizar')
  .superRefine((items, ctx) => {
    const ids = new Set<string>();
    const numeros = new Set<number>();
    items.forEach((item, index) => {
      if (ids.has(item.placaId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'placaId'], message: 'Placa duplicada na organização' });
      }
      ids.add(item.placaId);
      if (numeros.has(item.numeroOperacional)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'numeroOperacional'], message: 'Número operacional duplicado' });
      }
      numeros.add(item.numeroOperacional);
    });
  }),
});

export const ArchivePlacaSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CreatePlacaDTO = z.infer<typeof CreatePlacaSchema>;
export type UpdatePlacaDTO = z.infer<typeof UpdatePlacaSchema>;
export type ListPlacasQueryDTO = z.infer<typeof ListPlacasQuerySchema>;
export type PlacaImageDTO = z.infer<typeof PlacaImageSchema>;
export type UploadPlateImageDTO = z.infer<typeof UploadPlateImageSchema>;
export type CheckDisponibilidadeDTO = z.infer<typeof CheckDisponibilidadeSchema>;
export type ReorderPlacasDTO = z.infer<typeof ReorderPlacasSchema>;
export type ArchivePlacaDTO = z.infer<typeof ArchivePlacaSchema>;

// ============================================
// RESPONSE TYPES
// ============================================

export interface PlateImageMeta {
  _id: string;
  id?: string;
  url: string;
  key: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  category: string;
  isMain?: boolean;
  source?: 'UPLOAD' | 'GENERATED' | 'IMPORTED';
  uploadedBy?: string;
  uploadedAt: Date;
  updatedAt?: Date;
  generatedBy?: string;
  templateId?: string;
  generationSource?: string;
  overlayData?: unknown;
  version?: number;
}

/**
 * Placa completa (entidade).
 * Campo canônico de disponibilidade: `disponivel`.
 * `ativa` é alias legado de leitura.
 */
export interface PlacaEntity {
  _id: Types.ObjectId;
  numero_placa: string;
  numeroOperacional?: number;

  // Endereço
  endereco?: string;
  nomeDaRua?: string;
  localizacao?: string;
  latitude?: number;
  longitude?: number;
  coordenadas?: string | { latitude: number; longitude: number };

  // Imagens
  imagemPrincipal?: string;
  imagem?: string;
  imagens?: PlateImageMeta[];

  // Dimensões
  tamanho?: string;
  tipo?: string;
  largura?: number;
  altura?: number;
  valor_mensal?: number;

  // Status
  /** Campo canônico no MongoDB. */
  disponivel: boolean;
  /** @deprecated Alias legado — leia `disponivel`. */
  ativa?: boolean;
  statusOperacional?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'ARCHIVED';
  statusComercial?: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'UNAVAILABLE';

  // Observações
  notes?: string;
  observacoes?: string;

  // Região
  regiaoId: Types.ObjectId | { _id: Types.ObjectId; nome: string };
  regionId?: Types.ObjectId | { _id: Types.ObjectId; nome?: string; name?: string };
  regionalLot?: string;
  loteRegional?: string;

  empresaId: Types.ObjectId;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlacaListItem {
  _id?: string;
  id: string;
  numero_placa: string;
  numeroOperacional?: number;
  endereco?: string;
  nomeDaRua?: string;
  localizacao?: string;
  latitude?: number;
  longitude?: number;
  coordenadas?: string | { latitude: number; longitude: number };
  imagemPrincipal?: string;
  imagem?: string;
  regiao?: any;
  regiaoId?: any;
  regionId?: any;
  regionalLot?: string;
  loteRegional?: string;
  regiao_nome: string;
  tipo?: string;
  valor_mensal?: number;
  ativa: boolean;
  disponivel?: boolean;
  statusOperacional?: string;
  statusComercial?: string;
  notes?: string;
  aluguel_ativo?: boolean;
  aluguel_futuro?: boolean;
  statusAluguel?: 'disponivel' | 'alugada' | 'reservada';
  cliente_nome?: string;
  aluguel_data_inicio?: Date;
  aluguel_data_fim?: Date;
}

export interface PaginatedPlacasResponse {
  data: PlacaListItem[];
  pagination: {
    totalDocs: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface DisponibilidadeResponse {
  disponivel: boolean;
  placaId: string;
  conflitos?: Array<{
    aluguelId: string;
    startDate: Date;
    endDate: Date;
    cliente: string;
  }>;
}

export type PlateHealthStatus = 'HEALTHY' | 'ATTENTION' | 'CRITICAL';

export interface PlateHealthResult {
  score: number;
  status: PlateHealthStatus;
  issues: string[];
}

// ============================================
// HELPERS DE VALIDAÇÃO
// ============================================

export function validateCreatePlaca(data: unknown): CreatePlacaDTO {
  const normalized = stripCommercialPlateFields(data);
  if (normalized.ativa !== undefined && normalized.disponivel === undefined) {
    normalized.disponivel = normalized.ativa;
  }
  if (normalized.regionId && !normalized.regiaoId) normalized.regiaoId = normalized.regionId;
  if (normalized.regiaoId && !normalized.regionId) normalized.regionId = normalized.regiaoId;
  if (normalized.regionalLot && !normalized.loteRegional) normalized.loteRegional = normalized.regionalLot;
  if (normalized.loteRegional && !normalized.regionalLot) normalized.regionalLot = normalized.loteRegional;
  if (!normalized.endereco && normalized.nomeDaRua) normalized.endereco = normalized.nomeDaRua;
  if (!normalized.endereco && normalized.localizacao) normalized.endereco = normalized.localizacao;
  return CreatePlacaSchema.parse(normalized);
}

export function validateUpdatePlaca(data: unknown): UpdatePlacaDTO {
  const normalized = stripCommercialPlateFields(data);
  if (normalized.regionId && !normalized.regiaoId) normalized.regiaoId = normalized.regionId;
  if (normalized.regiaoId && !normalized.regionId) normalized.regionId = normalized.regiaoId;
  if (normalized.regionalLot && !normalized.loteRegional) normalized.loteRegional = normalized.regionalLot;
  if (normalized.loteRegional && !normalized.regionalLot) normalized.regionalLot = normalized.loteRegional;
  if (!normalized.endereco && normalized.nomeDaRua) normalized.endereco = normalized.nomeDaRua;
  if (!normalized.endereco && normalized.localizacao) normalized.endereco = normalized.localizacao;
  return UpdatePlacaSchema.parse(normalized);
}

export function validateListQuery(data: unknown): ListPlacasQueryDTO {
  const query = { ...(data as any) };
  if (query.regiao_id && !query.regiaoId) query.regiaoId = query.regiao_id;
  return ListPlacasQuerySchema.parse(query);
}

export function validatePlacaImage(data: unknown): PlacaImageDTO {
  return PlacaImageSchema.parse(data);
}

export function validateUploadPlateImage(data: unknown): UploadPlateImageDTO {
  return UploadPlateImageSchema.parse(data);
}

export function validateCheckDisponibilidade(data: unknown): CheckDisponibilidadeDTO {
  return CheckDisponibilidadeSchema.parse(data);
}

export function validateReorderPlacas(data: unknown): ReorderPlacasDTO {
  return ReorderPlacasSchema.parse(data);
}

export function validateArchivePlaca(data: unknown): ArchivePlacaDTO {
  return ArchivePlacaSchema.parse(data ?? {});
}

// ============================================
// TRANSFORMERS
// ============================================

export function toListItem(placa: PlacaEntity & any): PlacaListItem {
  const regiao = placa.regiaoId;
  const regiaoNome = typeof regiao === 'object' && regiao?.nome ? regiao.nome : 'Sem região';
  const regiaoId = typeof regiao === 'object' && regiao?._id ? regiao._id : regiao;
  const disponivel = placa.disponivel ?? placa.ativa ?? true;

  return {
    _id: placa._id.toString(),
    id: placa._id.toString(),
    numero_placa: placa.numero_placa,
    numeroOperacional: placa.numeroOperacional,
    endereco: placa.endereco || placa.nomeDaRua || placa.localizacao,
    nomeDaRua: placa.nomeDaRua || placa.endereco || placa.localizacao,
    localizacao: placa.localizacao || placa.nomeDaRua || placa.endereco,
    latitude: placa.latitude,
    longitude: placa.longitude,
    coordenadas: placa.coordenadas,
    imagemPrincipal: placa.imagemPrincipal || placa.imagem,
    imagem: placa.imagem || placa.imagemPrincipal,
    regiao: typeof regiao === 'object' ? regiao : { _id: regiaoId, id: regiaoId, nome: regiaoNome },
    regiaoId,
    regionId: placa.regionId || regiaoId,
    regionalLot: placa.regionalLot || placa.loteRegional,
    loteRegional: placa.loteRegional || placa.regionalLot,
    regiao_nome: regiaoNome,
    tipo: placa.tipo,
    valor_mensal: placa.valor_mensal,
    ativa: disponivel,
    disponivel,
    statusOperacional: placa.statusOperacional,
    statusComercial: placa.statusComercial,
    notes: placa.notes || placa.observacoes,
    aluguel_ativo: placa.aluguel_ativo,
    aluguel_futuro: placa.aluguel_futuro,
    statusAluguel: placa.statusAluguel,
    cliente_nome: placa.cliente_nome,
    aluguel_data_inicio: placa.aluguel_data_inicio,
    aluguel_data_fim: placa.aluguel_data_fim,
  };
}

export function toListItems(placas: Array<PlacaEntity & any>): PlacaListItem[] {
  return placas.map(toListItem);
}
