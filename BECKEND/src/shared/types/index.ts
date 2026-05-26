/**
 * Sistema de Tipagens Globais da API
 * Centraliza todas as interfaces, types e exports compartilhados
 */

import { Request, Response, NextFunction } from 'express';
import { Document, Types } from 'mongoose';

// ============================================
// TIPOS BASE E UTILITÁRIOS
// ============================================

/**
 * Tipo genérico para ObjectId do Mongoose
 */
export type ObjectId = Types.ObjectId;

/**
 * Tipo para documentos populados
 */
export type PopulatedDoc<T> = T | ObjectId;

/**
 * Tipo para respostas paginadas
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    totalDocs: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
}

/**
 * Tipo para query params de paginação
 */
export interface PaginationParams {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

/**
 * Tipo para query params de busca
 */
export interface SearchParams extends PaginationParams {
  search?: string;
  status?: string;
  [key: string]: any;
}

/**
 * Tipo para respostas de API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Tipo para erros customizados
 */
export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
  details?: any;
}

// ============================================
// INTERFACES DE MODELOS (RE-EXPORT)
// ============================================

export interface IBaseDocument extends Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICliente extends IBaseDocument {
  nome: string;
  cpfCnpj: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  ativo: boolean;
  logo?: string;
  empresaId: Types.ObjectId;
  razaoSocial?: string;
}

export interface IPlaca extends IBaseDocument {
  numero_placa: string;
  numero?: string;
  coordenadas?: string;
  nomeDaRua?: string;
  localizacao?: string;
  tamanho?: string;
  imagem?: string;
  disponivel: boolean;
  regiaoId: Types.ObjectId;
  empresaId: Types.ObjectId;
  statusAluguel?: string;
}

export interface IBiWeek extends IBaseDocument {
  bi_week_id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  year: number;
  empresaId: Types.ObjectId;
}

export interface IPropostaInterna extends IBaseDocument {
  empresaId: Types.ObjectId;
  clienteId: Types.ObjectId;
  pi_code: string;
  titulo?: string;
  produto?: string;
  periodType: string;
  startDate: Date;
  endDate: Date;
  biWeekIds?: string[];
  biWeeks?: Types.ObjectId[];
  placas?: Types.ObjectId[];
  valorProducao?: number;
  valorVeiculacao?: number;
  valorTotal?: number;
  condicoesPagamento?: string;
  status?: string;
}

export interface IContrato extends IBaseDocument {
  numero: string;
  clienteId: Types.ObjectId | ICliente;
  empresaId: Types.ObjectId;
  piId: Types.ObjectId;
  status: 'rascunho' | 'ativo' | 'concluido' | 'cancelado';
}

export interface IAluguel extends IBaseDocument {
  clienteId: Types.ObjectId;
  empresaId: Types.ObjectId;
  placaId: Types.ObjectId;
  biWeekId?: Types.ObjectId;
  periodType: 'biweekly' | 'monthly' | 'custom';
  startDate: Date;
  endDate: Date;
  valorAluguel: number;
  status: 'ativo' | 'concluido' | 'cancelado';
  observacoes?: string;
}

export interface IEmpresa extends IBaseDocument {
  nome: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  ativo: boolean;
  configuracoes?: Record<string, any>;
}

export interface IRegiao extends IBaseDocument {
  nome: string;
  cidade?: string;
  estado?: string;
  empresaId: Types.ObjectId;
  ativo: boolean;
}

export interface IUser extends IBaseDocument {
  nome: string;
  sobrenome?: string;
  email: string;
  senha: string;
  role: 'admin' | 'user' | 'viewer';
  empresaId: Types.ObjectId;
  ativo: boolean;
}

// ============================================
// TIPOS DE SERVIÇOS
// ============================================

/**
 * Interface base para serviços CRUD
 */
export interface ICrudService<T extends IBaseDocument> {
  create(data: Partial<T>, empresaId: string): Promise<T>;
  getAll(empresaId: string, queryParams: SearchParams): Promise<PaginatedResponse<T>>;
  getById(id: string, empresaId: string): Promise<T>;
  update(id: string, data: Partial<T>, empresaId: string): Promise<T>;
  delete(id: string, empresaId: string): Promise<void>;
}

/**
 * Opções para operações de banco de dados
 */
export interface DbOperationOptions {
  session?: any;
  populate?: string | string[] | Record<string, any>;
  select?: string | string[];
  lean?: boolean;
  runValidators?: boolean;
}

// ============================================
// TIPOS DE REQUEST E MIDDLEWARE
// ============================================

/**
 * Request estendido com dados do usuário autenticado
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    empresaId: string;
    role: string;
    email: string;
  };
  empresaId?: string;
}

/**
 * Tipo para middleware functions
 */
export type MiddlewareFn = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Tipo para controller functions
 */
export type ControllerFn = (
  req: AuthenticatedRequest,
  res: Response,
  next?: NextFunction
) => void | Promise<void>;

// ============================================
// TIPOS DE VALIDAÇÃO
// ============================================

/**
 * Resultado de validação
 */
export interface ValidationResult {
  success: boolean;
  data?: any;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Schema de validação genérico
 */
export interface ValidationSchema {
  [field: string]: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'objectId';
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean | string;
  };
}

// ============================================
// TIPOS DE UPLOAD E STORAGE
// ============================================

/**
 * Resultado de upload de arquivo
 */
export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  fileKey?: string;
  error?: string;
}

/**
 * Opções de upload
 */
export interface UploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  folder?: string;
  generateThumbnail?: boolean;
}

/**
 * Arquivo S3
 */
export interface S3File {
  key: string;
  bucket: string;
  url: string;
  size: number;
  contentType: string;
}

// ============================================
// TIPOS DE PDF E RELATÓRIOS
// ============================================

/**
 * Opções de geração de PDF
 */
export interface PdfGenerationOptions {
  format?: 'A4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  header?: string;
  footer?: string;
}

/**
 * Dados para PDF de contrato
 */
export interface ContratoPdfData {
  contrato: IContrato;
  pi: IPropostaInterna;
  cliente: ICliente;
  empresa: IEmpresa;
  placas?: IPlaca[];
}

// ============================================
// TIPOS DE CACHE E REDIS
// ============================================

/**
 * Opções de cache
 */
export interface CacheOptions {
  ttl?: number; // Time to live em segundos
  prefix?: string;
  namespace?: string;
}

/**
 * Cliente de cache
 */
export interface ICacheClient {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, options?: CacheOptions): Promise<void>;
  del(key: string | string[]): Promise<void>;
  clear(pattern?: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// ============================================
// TIPOS DE LOGGER
// ============================================

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LogMetadata {
  userId?: string;
  empresaId?: string;
  action?: string;
  ip?: string;
  [key: string]: any;
}

export interface ILogger {
  error(message: string, meta?: LogMetadata): void;
  warn(message: string, meta?: LogMetadata): void;
  info(message: string, meta?: LogMetadata): void;
  debug(message: string, meta?: LogMetadata): void;
}

// ============================================
// TIPOS DE QUEUE E JOBS
// ============================================

/**
 * Tipos de jobs
 */
export type JobType = 'pdf-generation' | 'email-sending' | 'data-sync' | 'cleanup';

/**
 * Dados de job
 */
export interface JobData {
  type: JobType;
  payload: any;
  priority?: number;
  attempts?: number;
  timeout?: number;
}

/**
 * Resultado de job
 */
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

// ============================================
// TIPOS DE AUTENTICAÇÃO
// ============================================

/**
 * Payload de JWT
 */
export interface JwtPayload {
  userId: string;
  empresaId: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Dados de login
 */
export interface LoginCredentials {
  email: string;
  senha: string;
}

/**
 * Resposta de autenticação
 */
export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: {
    id: string;
    nome: string;
    email: string;
    role: string;
    empresaId: string;
  };
  expiresIn?: number;
}

// ============================================
// TIPOS DE WEBHOOK E SSE
// ============================================

/**
 * Evento SSE
 */
export interface SSEEvent {
  event: string;
  data: any;
  id?: string;
  retry?: number;
}

/**
 * Payload de webhook
 */
export interface WebhookPayload {
  event: string;
  timestamp: Date;
  data: any;
  signature?: string;
}

// ============================================
// UTILITÁRIOS DE TIPO
// ============================================

/**
 * Torna todas as propriedades opcionais recursivamente
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Torna todas as propriedades required recursivamente
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Remove campos de um tipo
 */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * Torna campos específicos obrigatórios
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Extrai tipos de um array
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Tipo condicional para valores não-null
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

// ============================================
// CONSTANTES E ENUMS
// ============================================

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer'
}

export enum AluguelStatus {
  ATIVO = 'ativo',
  CONCLUIDO = 'concluido',
  CANCELADO = 'cancelado'
}

export enum ContratoStatus {
  RASCUNHO = 'rascunho',
  ATIVO = 'ativo',
  CONCLUIDO = 'concluido',
  CANCELADO = 'cancelado'
}

export enum PeriodType {
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom'
}

export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500
}

// ============================================
// HELPERS DE VALIDAÇÃO
// ============================================

/**
 * Verifica se é um ObjectId válido
 */
export const isValidObjectId = (id: any): id is ObjectId => {
  return Types.ObjectId.isValid(id);
};

/**
 * Converte string para ObjectId
 */
export const toObjectId = (id: string): ObjectId => {
  return new Types.ObjectId(id);
};

/**
 * Valida email
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida CNPJ
 */
export const isValidCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
  return cleanCNPJ.length === 14;
};

/**
 * Valida CPF
 */
export const isValidCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/[^\d]/g, '');
  return cleanCPF.length === 11;
};
