import { EventEmitter } from 'events';
import generator from './generator';
import logger from '../shared/container/logger';
import PiGenJob from '../models/PiGenJob';

interface UserData {
  nome?: string;
  email?: string;
  empresaId?: string;
  [key: string]: unknown;
}

interface JobOptions {
  format?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  [key: string]: unknown;
}

const ee = new EventEmitter();

function createJobId(): string {
  return `job_${Date.now()}_${Math.floor(Math.random()*10000)}`;
}

/**
 * start job and persist to MongoDB (PiGenJob)
 */
async function startJobGeneratePDF(
  contratoId: string,
  empresaId: string,
  user: UserData | null,
  options: JobOptions = {}
): Promise<string> {
  const jobId = createJobId();

  // create job document
  const jobDoc = new PiGenJob({
    jobId,
    type: 'generate_pdf',
    contratoId,
    empresaId: empresaId || null,
    status: 'queued'
  });
  await jobDoc.save();

  (async () => {
    try {
      jobDoc.status = 'running';
      jobDoc.updatedAt = new Date();
      await jobDoc.save();

      // Buffer gerado mas não persistido ainda — resultado identificado pela key.
      await generator.generatePDFBufferFromContrato(contratoId, empresaId, user, options);

      const key = `pigen/${jobId}.pdf`;

      jobDoc.status = 'done';
      jobDoc.resultPath = key;
      jobDoc.resultUrl = undefined;
      jobDoc.updatedAt = new Date();
      await jobDoc.save();

      ee.emit('done', jobId);
      logger.info(`[PISystemGen] job ${jobId} concluído`);
    } catch (err) {
      const error = err as Error;
      logger.error(`[PISystemGen] job ${jobId} falhou: ${error.message}`);
      try {
        jobDoc.status = 'failed';
        jobDoc.error = error.message;
        jobDoc.updatedAt = new Date();
        await jobDoc.save();
      } catch (saveErr) {
        const saveError = saveErr as Error;
        logger.error('[PISystemGen] erro ao salvar job falhado:', saveError.message);
      }
      ee.emit('failed', jobId);
    }
  })();

  return jobId;
}

async function getJob(jobId: string, empresaId: string) {
  if (!empresaId) throw new Error('[PISystemGen] empresaId é obrigatório para getJob');
  return PiGenJob.findOne({ jobId, empresaId }).lean();
}

export default { startJobGeneratePDF, getJob, ee };
