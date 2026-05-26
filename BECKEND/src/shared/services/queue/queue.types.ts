/**
 * Queue Service - Types & Interfaces
 * Definições de tipos para o serviço de filas
 */

export interface PDFJobData {
  jobId: string;
  entityId: string; // contratoId ou piId
  entityType: 'contrato' | 'pi';
  empresaId: string;
  user: any;
  options?: any;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  note?: string;
}

export interface JobStatus {
  jobId: string;
  type: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'sent_whatsapp';
  contratoId?: string;
  piId?: string;
  empresaId?: string;
  resultPath?: string;
  resultUrl?: string;
  error?: string;
  whatsappSent?: boolean;
  whatsappSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
