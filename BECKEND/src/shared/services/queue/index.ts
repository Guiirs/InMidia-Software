/**
 * Queue Service — BullMQ with fault-tolerant Redis guard.
 *
 * If Redis is unavailable at startup or later:
 *  - Queue/Worker/QueueEvents are never created (no dangling connections)
 *  - Jobs fall back to synchronous in-process execution
 *  - BullMQ error events are always handled (no unhandledRejection crash)
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { redisManager } from '@shared/infra/redis/redis-manager';
import config from '../../../config/config';
import logger from '../../container/logger';
import PiGenJob from '../../../models/PiGenJob';
import { PDFJobData, QueueStats, JobStatus } from './queue.types';
import { processPDFJob } from './queue.processor';

class QueueService {
  private static instance: QueueService;

  private pdfQueue: Queue | null      = null;
  private pdfWorker: Worker | null    = null;
  private queueEvents: QueueEvents | null = null;

  private constructor() {
    this._tryInitBullMQ();

    // Re-attempt BullMQ init when Redis connects (recovers from cold-start without Redis)
    const checkInterval = setInterval(() => {
      if (this.pdfQueue) {
        clearInterval(checkInterval);
        return;
      }
      if (redisManager.isConnected()) {
        logger.info('[QueueService] Redis disponível — iniciando BullMQ');
        this._tryInitBullMQ();
        clearInterval(checkInterval);
      }
    }, 5_000);
  }

  private _tryInitBullMQ(): void {
    if (!redisManager.isConnected()) {
      logger.warn('[QueueService] Redis indisponível — processamento direto ativo (sem fila)');
      return;
    }

    try {
      const connection = { url: config.redisUrl };

      this.pdfQueue = new Queue('pdf-generation', {
        connection,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 100,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
        },
      });

      this.queueEvents = new QueueEvents('pdf-generation', { connection });

      this.pdfWorker = new Worker(
        'pdf-generation',
        (job: Job<PDFJobData>) => this._processWithQueue(job),
        { connection, concurrency: 2, limiter: { max: 10, duration: 1_000 } },
      );

      // ── Error handlers are MANDATORY for BullMQ — unhandled errors crash Node ──
      this.pdfQueue.on('error',      (err) => logger.error(`[QueueService] Queue error: ${err.message}`));
      this.pdfWorker.on('error',     (err) => logger.error(`[QueueService] Worker error: ${err.message}`));
      this.pdfWorker.on('failed',    (job, err) => logger.error(`[QueueService] Job ${job?.id} falhou: ${err.message}`));
      this.pdfWorker.on('completed', (job) => logger.info(`[QueueService] Job ${job.id} concluído`));
      this.queueEvents.on('error',   (err) => logger.error(`[QueueService] QueueEvents error: ${err.message}`));

      logger.info('[QueueService] BullMQ inicializado com sucesso');
    } catch (err: any) {
      logger.error(`[QueueService] Falha ao inicializar BullMQ: ${err.message}`);
      this._destroyBullMQ();
    }
  }

  private _destroyBullMQ(): void {
    try { this.pdfWorker?.removeAllListeners(); } catch {}
    try { this.pdfQueue?.removeAllListeners(); } catch {}
    try { this.queueEvents?.removeAllListeners(); } catch {}
    this.pdfQueue      = null;
    this.pdfWorker     = null;
    this.queueEvents   = null;
  }

  static getInstance(): QueueService {
    if (!QueueService.instance) QueueService.instance = new QueueService();
    return QueueService.instance;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async addPDFJob(entityId: string, empresaId: string, user: any, options: any = {}): Promise<string> {
    const jobId      = `job_${Date.now()}_${Math.floor(Math.random() * 10_000)}`;
    const entityType = options.type || 'contrato';

    const jobDoc = new PiGenJob({
      jobId,
      type:       'generate_pdf',
      contratoId: entityType === 'contrato' ? entityId : null,
      empresaId:  empresaId || null,
      status:     'queued',
    });
    await jobDoc.save();

    const jobData: PDFJobData = { jobId, entityId, entityType, empresaId, user, options };

    if (!this.pdfQueue) {
      logger.warn(`[QueueService] Sem fila — processando job ${jobId} diretamente`);
      await this._processDirect(jobData);
      return jobId;
    }

    await this.pdfQueue.add('generate-pdf', jobData, { jobId, priority: 0, delay: 0 });
    logger.info(`[QueueService] Job ${jobId} enfileirado para ${entityType} ${entityId}`);
    return jobId;
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    return PiGenJob.findOne({ jobId }).lean() as Promise<JobStatus | null>;
  }

  async getQueueStats(): Promise<QueueStats> {
    if (!this.pdfQueue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0,
               note: 'Queue indisponível — Redis offline' };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.pdfQueue.getWaiting(),
      this.pdfQueue.getActive(),
      this.pdfQueue.getCompleted(),
      this.pdfQueue.getFailed(),
      this.pdfQueue.getDelayed(),
    ]);

    return {
      waiting:   waiting.length,
      active:    active.length,
      completed: completed.length,
      failed:    failed.length,
      delayed:   delayed.length,
    };
  }

  async close(): Promise<void> {
    logger.info('[QueueService] Encerrando...');
    try { if (this.pdfWorker)   await this.pdfWorker.close(); }   catch (e: any) { logger.warn(`[QueueService] worker close: ${e.message}`); }
    try { if (this.queueEvents) await this.queueEvents.close(); } catch (e: any) { logger.warn(`[QueueService] events close: ${e.message}`); }
    try { if (this.pdfQueue)    await this.pdfQueue.close(); }    catch (e: any) { logger.warn(`[QueueService] queue close: ${e.message}`); }
    logger.info('[QueueService] Encerrado');
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async _processWithQueue(job: Job<PDFJobData>): Promise<void> {
    await processPDFJob(job.data);
  }

  private async _processDirect(jobData: PDFJobData): Promise<void> {
    await processPDFJob(jobData);
  }
}

export * from './queue.types';
export default QueueService.getInstance();
