/**
 * Queue Service - Main Entry Point
 * Gerenciamento de filas com BullMQ/Redis
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import RedisConfig from '../../../config/redis';
import config from '../../../config/config';
import logger from '../../container/logger';
import PiGenJob from '../../../models/PiGenJob';
import { PDFJobData, QueueStats, JobStatus } from './queue.types';
import { processPDFJob } from './queue.processor';

class QueueService {
  private static instance: QueueService;
  private pdfQueue: Queue | null = null;
  private pdfWorker: Worker | null = null;
  private queueEvents: QueueEvents | null = null;
  private redisAvailable: boolean = false;

  private constructor() {
    // Check if Redis is available synchronously
    this.redisAvailable = RedisConfig.isEnabled();

    if (!this.redisAvailable) {
      logger.warn('[QueueService] ⚠️ Redis desativado - processamento direto será usado');
      return;
    }

    try {
      // Initialize Redis connection
      RedisConfig.connect().catch((err) => {
        logger.error('[QueueService] Failed to connect to Redis:', err.message);
      });

      // Create PDF generation queue
      this.pdfQueue = new Queue('pdf-generation', {
        connection: { url: config.redisUrl },
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      // Create queue events handler
      this.queueEvents = new QueueEvents('pdf-generation', {
        connection: { url: config.redisUrl },
      });

      // Setup event listeners
      this.setupQueueEvents();

      // Create worker with concurrency of 2
      this.pdfWorker = new Worker(
        'pdf-generation',
        this.processPDFJobWithQueue.bind(this),
        {
          connection: { url: config.redisUrl },
          concurrency: 2,
          limiter: {
            max: 10,
            duration: 1000,
          },
        }
      );

      // Setup worker event listeners
      this.setupWorkerEvents();

      logger.info('[QueueService] PDF Queue Service initialized');
    } catch (error: any) {
      logger.error('[QueueService] Failed to initialize:', error.message);
      this.redisAvailable = false;
    }
  }

  private setupWorkerEvents(): void {
    if (!this.pdfWorker) return;

    this.pdfWorker.on('completed', (job) => {
      logger.info(`[QueueService] Worker completed job ${job.id}`);
    });

    this.pdfWorker.on('failed', (job, err) => {
      logger.error(`[QueueService] Worker failed job ${job?.id}: ${err.message}`);
    });

    this.pdfWorker.on('active', (job) => {
      logger.info(`[QueueService] Worker started processing job ${job.id}`);
    });
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  private setupQueueEvents(): void {
    if (!this.queueEvents) return;

    this.queueEvents.on('waiting', ({ jobId }) => {
      logger.debug(`[QueueService] Job ${jobId} is waiting in queue`);
    });

    this.queueEvents.on('active', ({ jobId }) => {
      logger.debug(`[QueueService] Job ${jobId} is now active`);
    });

    this.queueEvents.on('completed', ({ jobId }) => {
      logger.debug(`[QueueService] Job ${jobId} has been completed`);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`[QueueService] Job ${jobId} has failed: ${failedReason}`);
    });
  }

  private async processPDFJobWithQueue(job: Job<PDFJobData>): Promise<void> {
    await processPDFJob(job.data);
  }

  private async processPDFJobDirect(jobData: PDFJobData): Promise<void> {
    await processPDFJob(jobData);
  }

  public async addPDFJob(entityId: string, empresaId: string, user: any, options: any = {}): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const entityType = options.type || 'contrato';

    // Create job document in MongoDB
    const jobDoc = new PiGenJob({
      jobId,
      type: 'generate_pdf',
      contratoId: entityType === 'contrato' ? entityId : null,
      empresaId: empresaId || null,
      status: 'queued'
    });
    await jobDoc.save();

    const jobData: PDFJobData = {
      jobId,
      entityId,
      entityType,
      empresaId,
      user,
      options
    };

    // Check if queue is available
    if (!this.pdfQueue) {
      logger.warn(`[QueueService] Queue not available - processing job ${jobId} directly`);
      await this.processPDFJobDirect(jobData);
      return jobId;
    }

    // Add job to BullMQ queue
    await this.pdfQueue.add('generate-pdf', jobData, {
      jobId,
      priority: 0,
      delay: 0,
    });

    logger.info(`[QueueService] Added PDF job ${jobId} to queue for ${entityType} ${entityId}`);
    return jobId;
  }

  public async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const mongoJob = await PiGenJob.findOne({ jobId }).lean();
    return mongoJob as JobStatus | null;
  }

  public async getQueueStats(): Promise<QueueStats> {
    if (!this.pdfQueue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        note: 'Queue not available - Redis disabled'
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
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  public async close(): Promise<void> {
    logger.info('[QueueService] Closing queue service...');

    if (this.pdfWorker) {
      await this.pdfWorker.close();
    }
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
    if (this.pdfQueue) {
      await this.pdfQueue.close();
    }

    logger.info('[QueueService] Queue service closed');
  }
}

export default QueueService.getInstance();

