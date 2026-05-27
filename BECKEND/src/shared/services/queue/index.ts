/**
 * Queue Service — BullMQ with fault-tolerant Redis guard.
 *
 * Startup behavior:
 *  - waitUntilReady(3 s) before deciding whether Redis is available
 *  - If Redis connects within 3 s → BullMQ initialized
 *  - If not → direct in-process fallback, retry every 30 s
 *  - If Redis disconnects later → BullMQ torn down, fallback activates
 *  - If Redis reconnects → BullMQ re-initialized automatically
 *
 * All BullMQ error events are handled — no unhandledRejection crash.
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
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    // Diagnostic: log Redis state at the moment QueueService is created
    logger.info(`[QueueService] Inicializando — Redis state=${redisManager.getState()}`);

    // Try after a short wait so redisManager has time to connect
    void this._deferredInit();

    // React to future Redis state changes
    redisManager.on('ready',    () => this._onRedisReady());
    redisManager.on('degraded', () => this._onRedisDegraded());
  }

  private async _deferredInit(): Promise<void> {
    // Wait up to 3 s for Redis — handles the async startup gap
    const connected = await redisManager.waitUntilReady(3_000);

    logger.info(
      `[QueueService] Redis após waitUntilReady(3000ms): ` +
      `${connected ? '✅ conectado — iniciando BullMQ' : '⚠️ indisponível — modo direto ativo'}`
    );

    if (connected) {
      this._initBullMQ();
    } else {
      this._startRetry();
    }
  }

  private _onRedisReady(): void {
    if (this.pdfQueue) return; // already initialized
    logger.info('[QueueService] Redis conectou (evento ready) — inicializando BullMQ');
    this._stopRetry();
    this._initBullMQ();
  }

  private _onRedisDegraded(): void {
    if (!this.pdfQueue) return; // already in fallback
    logger.warn('[QueueService] Redis degraded — destruindo BullMQ, ativando fallback direto');
    void this._destroyBullMQ();
    this._startRetry();
  }

  private _initBullMQ(): void {
    if (!redisManager.isConnected()) return;

    try {
      const connection = { url: config.redisUrl };

      this.pdfQueue = new Queue('pdf-generation', {
        connection,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail:    100,
          attempts:        3,
          backoff: { type: 'exponential', delay: 2_000 },
        },
      });

      this.queueEvents = new QueueEvents('pdf-generation', { connection });

      this.pdfWorker = new Worker(
        'pdf-generation',
        (job: Job<PDFJobData>) => processPDFJob(job.data),
        { connection, concurrency: 2, limiter: { max: 10, duration: 1_000 } },
      );

      // All error handlers are REQUIRED — unhandled BullMQ errors crash Node
      this.pdfQueue.on('error',      (e) => logger.error(`[QueueService] Queue error: ${e.message}`));
      this.pdfWorker.on('error',     (e) => logger.error(`[QueueService] Worker error: ${e.message}`));
      this.pdfWorker.on('failed',    (job, e) => logger.error(`[QueueService] Job ${job?.id} falhou: ${e.message}`));
      this.pdfWorker.on('completed', (job) => logger.info(`[QueueService] Job ${job.id} concluído`));
      this.queueEvents.on('error',   (e) => logger.error(`[QueueService] QueueEvents error: ${e.message}`));

      logger.info('[QueueService] ✅ BullMQ inicializado');
    } catch (err: any) {
      logger.error(`[QueueService] Falha ao inicializar BullMQ: ${err.message}`);
      void this._destroyBullMQ();
    }
  }

  private async _destroyBullMQ(): Promise<void> {
    try { this.pdfWorker?.removeAllListeners();   await this.pdfWorker?.close();   } catch {}
    try { this.queueEvents?.removeAllListeners(); await this.queueEvents?.close(); } catch {}
    try { this.pdfQueue?.removeAllListeners();    await this.pdfQueue?.close();    } catch {}
    this.pdfWorker   = null;
    this.queueEvents = null;
    this.pdfQueue    = null;
  }

  private _startRetry(): void {
    if (this.retryTimer) return;
    this.retryTimer = setInterval(() => {
      if (redisManager.isConnected() && !this.pdfQueue) {
        logger.info('[QueueService] Retry: Redis disponível — inicializando BullMQ');
        this._stopRetry();
        this._initBullMQ();
      }
    }, 30_000);
  }

  private _stopRetry(): void {
    if (this.retryTimer) { clearInterval(this.retryTimer); this.retryTimer = null; }
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
      logger.warn(`[QueueService] Sem fila — processando ${jobId} diretamente (Redis: ${redisManager.getState()})`);
      await processPDFJob(jobData);
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
      return {
        waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0,
        note: `Fila indisponível (Redis: ${redisManager.getState()})`,
      };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.pdfQueue.getWaiting(),
      this.pdfQueue.getActive(),
      this.pdfQueue.getCompleted(),
      this.pdfQueue.getFailed(),
      this.pdfQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length, active: active.length,
      completed: completed.length, failed: failed.length, delayed: delayed.length,
    };
  }

  async close(): Promise<void> {
    logger.info('[QueueService] Encerrando...');
    this._stopRetry();
    redisManager.removeAllListeners('ready');
    redisManager.removeAllListeners('degraded');
    await this._destroyBullMQ();
    logger.info('[QueueService] Encerrado');
  }
}

export * from './queue.types';
export default QueueService.getInstance();
