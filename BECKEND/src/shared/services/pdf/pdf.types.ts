/**
 * PDF Service - Type Definitions
 * Interfaces completas para geração de PDFs
 */

import PDFDocument from 'pdfkit';

/**
 * Tipo do documento PDFKit (prototype)
 */
export type PDFDocumentInstance = InstanceType<typeof PDFDocument>;

/**
 * Endereço completo
 */
export interface Endereco {
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

/**
 * Interface para dados da Empresa
 */
export interface EmpresaData {
  _id: string;
  nome: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  logo_url?: string;
}

/**
 * Interface para dados do Cliente
 */
export interface ClienteData {
  _id: string;
  nome: string;
  cnpj?: string;
  cpf?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  segmento?: string;
  responsavel?: string; // Responsável do cliente
}

/**
 * Interface para dados de Região
 */
export interface RegiaoData {
  _id: string;
  nome: string;
  codigo?: string;
}

/**
 * Interface para dados de Placa
 */
export interface PlacaData {
  _id: string;
  numero_placa: string;
  codigo?: string;
  tipo?: 'busdoor' | 'backbus' | 'frontbus' | 'empena' | 'painel' | 'outdoor' | 'totem';
  regiao?: RegiaoData;
  latitude?: number;
  longitude?: number;
  ativa?: boolean;
}

/**
 * Interface para dados de PI (Proposta Interna)
 */
export interface PIData {
  _id: string;
  pi_id?: string;
  produto?: string;
  descricao?: string;
  descricaoPeriodo?: string;
  tipoPeriodo?: 'quinzenal' | 'mensal' | 'customizado';
  dataInicio: Date | string;
  dataFim: Date | string;
  valorTotal?: number;
  valorProducao?: number;
  valorVeiculacao?: number;
  placas?: PlacaData[];
  cliente?: ClienteData;
  empresa?: EmpresaData;
  status?: 'draft' | 'pendente' | 'aprovada' | 'rejeitada' | 'contrato_gerado';
  observacoes?: string;
  formaPagamento?: string; // Forma de pagamento
  condicoesPagamento?: string; // Condições de pagamento
}

/**
 * Interface para dados de Contrato
 */
export interface ContratoData {
  _id: string;
  contrato_id?: string;
  pi?: PIData | string;
  cliente?: ClienteData | string;
  empresa?: EmpresaData | string;
  dataAssinatura?: Date | string;
  dataInicio: Date | string;
  dataFim: Date | string;
  valorTotal?: number;
  valorProducao?: number;
  status?: 'ativo' | 'pendente' | 'finalizado' | 'cancelado';
  observacoes?: string;
  produto?: string;
  descricao?: string;
  placas?: PlacaData[];
}

/**
 * Interface para dados do Utilizador
 */
export interface UserData {
  _id: string;
  username: string;
  nome?: string;
  sobrenome?: string;
  email: string;
  role?: 'admin' | 'user' | 'viewer';
  avatar_url?: string;
}

/**
 * Opções de conversão XLSX para PDF
 */
export interface XlsxToPdfOptions {
  orientation?: 'portrait' | 'landscape';
  format?: 'A4' | 'Letter' | 'A3';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  scale?: number;
}

/**
 * Resultado de upload para Storage (R2/S3)
 */
export interface StorageUploadResult {
  url: string | null;
  key: string;
  size?: number;
}

/**
 * Tipo de documento PDF
 */
export type TipoDocumento = 'PI' | 'CONTRATO' | 'Contrato';

/**
 * Parâmetros para geração de PDF
 */
export interface PDFGenerationParams {
  tipoDoc: TipoDocumento;
  docId: string;
  empresa: EmpresaData;
  cliente: ClienteData;
  pi: PIData;
  user: UserData;
  contrato?: ContratoData;
}

/**
 * Resultado de geração de PDF em Buffer
 */
export interface PDFBufferResult {
  buffer: Buffer;
  filename: string;
  size: number;
}
