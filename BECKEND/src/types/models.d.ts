import { Document, Types } from 'mongoose';

/**
 * Base Mongoose document interface
 */
export interface IBaseDocument extends Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cliente Interface — V4.1 canonical model
 * Legacy fields (cpfCnpj, ativo) preserved for backward compat with v1 routes.
 */
export interface ICliente extends IBaseDocument {
  // ── V4.1 canonical ────────────────────────────────────────────────────────
  tipoPessoa?: 'PF' | 'PJ';
  documento?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'ARCHIVED';
  nomeFantasia?: string;
  whatsapp?: string;
  observacoes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  // ── Core fields ──────────────────────────────────────────────────────────
  nome: string;
  responsavel?: string;
  segmento?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  empresaId: Types.ObjectId;
  // ── Legacy / backward compat ─────────────────────────────────────────────
  /** @deprecated Use documento */
  cpfCnpj?: string;
  /** @deprecated Use status */
  ativo?: boolean;
  empresa?: Types.ObjectId;
  logo_url?: string;
}

/**
 * Imagem embutida na Placa
 */
export interface IPlateImage {
  _id: Types.ObjectId;
  id?: string;
  url: string;
  key: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  category: 'MAIN' | 'INSTALLATION' | 'SCRAPING' | 'MAINTENANCE' | 'BEFORE' | 'AFTER' | 'OTHER';
  isMain?: boolean;
  source?: 'UPLOAD' | 'GENERATED' | 'IMPORTED';
  uploadedBy?: Types.ObjectId;
  uploadedAt: Date;
  updatedAt?: Date;
  generatedBy?: string;
  templateId?: string;
  generationSource?: string;
  overlayData?: unknown;
  version?: number;
}

/**
 * Placa Interface
 */
export interface IPlaca extends IBaseDocument {
  // ── Número e identificação ─────────────────────────────────────────────
  numero_placa: string;
  numeroOperacional?: number;

  // ── Endereço e localização ─────────────────────────────────────────────
  /** Campo canônico de endereço. */
  endereco?: string;
  /** @deprecated Use endereco. */
  nomeDaRua?: string;
  /** @deprecated Use endereco. */
  localizacao?: string;
  latitude?: number;
  longitude?: number;
  /** @deprecated Use latitude/longitude. Formato "lat,lng". */
  coordenadas?: string;

  // ── Imagens ───────────────────────────────────────────────────────────
  /** URL canônica da imagem principal (R2). */
  imagemPrincipal?: string;
  /** @deprecated Use imagemPrincipal. */
  imagem?: string;
  imagens?: IPlateImage[];

  // ── Dimensões ─────────────────────────────────────────────────────────
  tamanho?: string;
  tipo?: string;
  largura?: number;
  altura?: number;
  valor_mensal?: number;

  // ── Status ────────────────────────────────────────────────────────────
  /** Campo canônico de disponibilidade física. */
  disponivel: boolean;
  statusOperacional?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'ARCHIVED';
  statusComercial?: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'UNAVAILABLE';

  // ── Observações ───────────────────────────────────────────────────────
  notes?: string;
  /** @deprecated Use notes. */
  observacoes?: string;

  // ── Região ────────────────────────────────────────────────────────────
  regiaoId: Types.ObjectId; // Novo padrão
  regionId?: Types.ObjectId;
  regionalLot?: string;
  loteRegional?: string;

  // ── Empresa ───────────────────────────────────────────────────────────
  empresaId: Types.ObjectId;
  regiao?: Types.ObjectId | IRegiao; // Virtual/legado
  empresa?: Types.ObjectId; // Virtual/legado
  statusAluguel?: string; // Virtual calculado

  // ── Auditoria e soft delete ───────────────────────────────────────────
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
}

/**
 * BiWeek Interface
 */
export interface IBiWeek extends IBaseDocument {
  bi_week_id: string;
  ano: number;
  numero: number;
  dataInicio: Date;
  dataFim: Date;
  descricao?: string;
  ativo: boolean;
  getFormattedPeriod(): string;
}

/**
 * Aluguel Interface
 * 
 * Representa um aluguel (locação) de uma placa para um cliente por um período específico.
 * Suporta sistema unificado de períodos (bi-week, custom) e mantém campos legados para compatibilidade.
 * 
 * @since 2.0.0 - Sistema de períodos unificado
 * @since 1.0.0 - Versão original com campos legados
 */
export interface IAluguel extends IBaseDocument {
  // Relacionamentos principais
  clienteId: Types.ObjectId | ICliente;
  placaId: Types.ObjectId | IPlaca;
  empresaId: Types.ObjectId | IEmpresa;
  
  // Sistema de Períodos Unificado (v2.0+)
  periodType: string;
  startDate: Date;
  endDate: Date;
  biWeekIds?: string[];
  biWeeks?: Types.ObjectId[];
  
  /**
   * @deprecated Use startDate instead. Mantido para compatibilidade com dados legados.
   * @since 1.0.0
   * @removed 3.0.0 (planejado)
   */
  data_inicio?: Date;
  
  /**
   * @deprecated Use endDate instead. Mantido para compatibilidade com dados legados.
   * @since 1.0.0
   * @removed 3.0.0 (planejado)
   */
  data_fim?: Date;
  
  /**
   * @deprecated Use biWeekIds instead. Mantido para compatibilidade com dados legados.
   * @since 1.0.0
   * @removed 3.0.0 (planejado)
   */
  bi_week_ids?: string[];
  
  // Integração PI (Proposta Interna)
  pi_code?: string;
  proposta_interna?: Types.ObjectId;
  tipo: 'manual' | 'pi';
  
  // Status e observações
  status: 'ativo' | 'finalizado' | 'cancelado';
  observacoes?: string;
}

/**
 * User Interface
 */
export interface IUser extends IBaseDocument {
  username: string;
  nome: string;
  email: string;
  senha: string;
  password?: string; // Campo legado para compatibilidade
  telefone?: string;
  role:
    | 'user'
    | 'admin'
    | 'superadmin'
    | 'admin_empresa'
    | 'gestor'
    | 'vendedor'
    | 'financeiro'
    | 'visualizador';
  ativo: boolean;
  lastLogin?: Date;
  resetToken?: string;
  tokenExpiry?: Date;
  empresaId: Types.ObjectId; // Alias/novo padrão
  empresa: Types.ObjectId; // Campo real no banco (tem alias no schema)
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/**
 * Empresa Interface
 */
export interface IEmpresa extends IBaseDocument {
  nome: string;
  cnpj: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  ativo: boolean;
  apiKey?: string;
  api_key_hash?: string;
  api_key_prefix?: string;
  api_key_last_used_at?: Date;
  enforce_bi_week_validation?: boolean;
  api_key_history?: Array<{
    regenerated_by: Types.ObjectId;
    regenerated_at: Date;
    ip_address?: string;
    user_agent?: string;
  }>;
  generateApiKey(): string;
}

/**
 * Regiao Interface
 */
export interface IRegiao extends IBaseDocument {
  nome: string;
  codigo: string;
  descricao?: string;
  name?: string;
  code?: string;
  description?: string;
  city?: string;
  state?: string;
  centerLatitude?: number;
  centerLongitude?: number;
  color?: string;
  ownerName?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  notes?: string;
  polygon?: unknown;
  metadata?: Record<string, unknown>;
  operationalPriority?: number;
  sortOrder?: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  ativo: boolean;
  empresaId: Types.ObjectId; // Novo padrão
  empresa?: Types.ObjectId; // Virtual/legado
}

/**
 * Contrato Interface
 */
export interface IContrato extends IBaseDocument {
  numero: string;
  clienteId: Types.ObjectId | ICliente;
  empresaId: Types.ObjectId | IEmpresa;
  piId: Types.ObjectId;
  status: 'rascunho' | 'ativo' | 'concluido' | 'cancelado';
}

/**
 * PropostaInterna Interface
 */
export interface IPropostaInterna extends IBaseDocument {
  empresaId: Types.ObjectId | IEmpresa;
  clienteId: Types.ObjectId | ICliente;
  pi_code: string;
  periodType: string;
  startDate: Date;
  endDate: Date;
  biWeekIds?: string[];
  biWeeks?: Types.ObjectId[];
  // Legacy fields
  tipoPeriodo?: 'quinzenal' | 'mensal';
  dataInicio?: Date;
  dataFim?: Date;
  valorTotal: number;
  valorProducao?: number;
  descricao: string;
  descricaoPeriodo?: string;
  produto?: string;
  placas?: Types.ObjectId[];
  formaPagamento?: string;
  nomeCampanha?: string;
  status:
    // V4.1 canonical
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'CONTRACT_GENERATED'
    | 'CANCELLED'
    // Legacy — kept for backward compatibility
    | 'em_andamento'
    | 'concluida'
    | 'vencida';
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

/**
 * Webhook Interface
 */
export interface IWebhook extends IBaseDocument {
  empresaId: Types.ObjectId | IEmpresa; // Novo padrão
  empresa?: Types.ObjectId | IEmpresa; // Virtual/legado
  nome: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  secret: string;
  retry_config: {
    max_tentativas: number;
    timeout_ms: number;
  };
  headers: Map<string, string>;
  estatisticas: {
    total_disparos: number;
    sucessos: number;
    falhas: number;
    ultimo_disparo?: Date;
    ultimo_sucesso?: Date;
    ultima_falha?: Date;
    ultima_falha_detalhes?: string;
  };
  criado_por: Types.ObjectId | IUser;
  registrarDisparo(sucesso: boolean, detalhes?: string | null): Promise<IWebhook>;
  escutaEvento(evento: string): boolean;
}

/**
 * PiGenJob Interface
 */
export interface IPiGenJob extends IBaseDocument {
  jobId: string;
  type: string;
  contratoId?: Types.ObjectId | IContrato;
  empresaId?: Types.ObjectId | IEmpresa;
  status: 'queued' | 'running' | 'done' | 'failed';
  resultPath?: string;
  resultUrl?: string;
  error?: string;
  progress?: number;
  whatsappSent?: boolean;
  whatsappSentAt?: Date;
}
