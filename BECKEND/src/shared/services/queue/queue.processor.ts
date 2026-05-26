/**
 * Queue Service - PDF Job Processor
 * Processa jobs de geração de PDF
 */

import path from 'path';
import fs from 'fs/promises';
import { v4 as uuid } from 'uuid';
import logger from '../../container/logger';
import PdfService from '../pdf';
import { uploadFilePath } from '../../container/storage.service';
import PiGenJob from '../../../models/PiGenJob';
import { PDFJobData } from './queue.types';

/**
 * Salva buffer em arquivo temporário
 */
export async function saveBufferToTemp(buffer: Buffer, extension: string): Promise<string> {
  const tempDir = path.join(__dirname, '..', '..', '..', 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  const fileName = `${uuid()}.${extension}`;
  const filePath = path.join(tempDir, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Processa job de geração de PDF
 */
export async function processPDFJob(jobData: PDFJobData): Promise<void> {
  const { jobId, entityId, entityType, empresaId, user, options = {} } = jobData;

  logger.info(`[QueueService] Processing PDF job ${jobId} for ${entityType} ${entityId}`);

  try {
    // Update job status to running
    await PiGenJob.findOneAndUpdate(
      { jobId },
      {
        status: 'running',
        updatedAt: new Date()
      }
    );

    // Generate PDF buffer based on entity type
    let buffer: Buffer;
    if (entityType === 'contrato') {
      buffer = await generateContratoPDF(entityId, empresaId, user, options);
    } else if (entityType === 'pi') {
      buffer = await generatePIPDF(entityId, empresaId, user);
    } else {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // Save temp locally first
    const localPath = await saveBufferToTemp(buffer, 'pdf');

    // Upload to storage (S3 or local fallback)
    const key = `pigen/${jobId}.pdf`;
    let uploadResult;
    try {
      uploadResult = await uploadFilePath(localPath, key, 'application/pdf');
    } catch (e: any) {
      logger.warn('[QueueService] Upload failure, keeping local file:', e.message);
      uploadResult = { url: null, key: localPath };
    }

    // Update job status to completed
    await PiGenJob.findOneAndUpdate(
      { jobId },
      {
        status: 'done',
        resultPath: localPath,
        resultUrl: uploadResult.url || null,
        updatedAt: new Date()
      }
    );

    logger.info(`[QueueService] PDF job ${jobId} completed successfully: ${localPath}`);

    // Cleanup: Remove temporary file after successful upload
    try {
      await fs.unlink(localPath);
      logger.debug(`[QueueService] Temporary file cleaned up: ${localPath}`);
    } catch (cleanupErr: any) {
      logger.warn(`[QueueService] Failed to cleanup temp file ${localPath}: ${cleanupErr.message}`);
    }

  } catch (error: any) {
    logger.error(`[QueueService] PDF job ${jobId} failed: ${error.message}`);

    // Update job status to failed
    try {
      await PiGenJob.findOneAndUpdate(
        { jobId },
        {
          status: 'failed',
          error: error.message,
          updatedAt: new Date()
        }
      );
    } catch (saveErr: any) {
      logger.error('[QueueService] Error saving failed job status:', saveErr.message);
    }

    throw error;
  }
}

/**
 * Gera PDF de contrato
 */
async function generateContratoPDF(
  entityId: string,
  empresaId: string,
  user: any,
  options: any
): Promise<Buffer> {
  const Contrato = require('../../../models/Contrato').default;
  const contrato = await Contrato.findOne({ _id: entityId, empresa: empresaId })
    .populate('empresa')
    .populate({ path: 'pi', populate: { path: 'cliente' } })
    .lean();
    
  if (!contrato) throw new Error('Contrato não encontrado');
  
  const pi = contrato.pi;
  const cliente = contrato.pi?.cliente;
  const empresa = contrato.empresa;
  const userFallback = user || { nome: 'Atendimento' };
  
  return await PdfService.generateContrato_PDF_Buffer(pi, cliente, empresa, userFallback, options) as Buffer;
}

/**
 * Gera PDF de PI
 */
async function generatePIPDF(
  entityId: string,
  empresaId: string,
  user: any
): Promise<Buffer> {
  const PI = (await import('../../../modules/propostas-internas/PropostaInterna')).default;
  const pi = await PI.findOne({ _id: entityId, empresaId: empresaId })
    .populate('clienteId')
    .populate('empresaId')
    .lean();
    
  if (!pi) throw new Error('PI não encontrado');
  
  const cliente = pi.clienteId;
  const empresa = pi.empresaId;
  const userFallback = user || { nome: 'Atendimento' };
  
  return await PdfService.generatePI_PDF_Buffer(pi, cliente, empresa, userFallback) as Buffer;
}
