/**
 * Queue Controller
 * Gerenciamento de filas
 */
// src/modules/system/queue/queue.controller.ts
import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express';

// IAuthRequest estende Express.Request (namespace), não express.Request (classe HTTP).
// Este alias garante que os handlers têm params/body/query disponíveis.
type AuthReq = Request & IAuthRequest;
import QueueService from '../../../shared/container/queue.service';
import PiGenJob from '../../../models/PiGenJob';
import logger from '../../../shared/container/logger';

const queueService = QueueService;

/**
 * Inicia geração de PDF de Contrato via Queue
 */
export async function generateContratoPDF(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const userId = (req.user as any).id;
    const contratoId = req.params.id as string;
    const { options } = req.body || {};

    logger.info(`[QueueController] generateContratoPDF requisitado para contrato ${contratoId} por user ${userId} (Empresa ${empresaId}).`);

    try {
        const jobId = await queueService.addPDFJob(contratoId, empresaId, req.user, {
            type: 'contrato',
            ...options
        });

        res.status(202).json({
            success: true,
            jobId,
            message: 'PDF generation started. Check status with /api/v1/queue/jobs/{jobId}',
            statusUrl: `/api/v1/queue/jobs/${jobId}`
        });
    } catch (err: any) {
        logger.error(`[QueueController] Error starting contrato PDF generation: ${err.message}`);
        next(err);
    }
}

/**
 * Inicia geração de PDF de PI via Queue
 */
export async function generatePIPDF(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const userId = (req.user as any).id;
    const piId = req.params.id as string;
    const { options } = req.body || {};

    logger.info(`[QueueController] generatePIPDF requisitado para PI ${piId} por user ${userId} (Empresa ${empresaId}).`);

    try {
        const jobId = await queueService.addPDFJob(piId, empresaId, req.user, {
            type: 'pi',
            ...options
        });

        res.status(202).json({
            success: true,
            jobId,
            message: 'PDF generation started. Check status with /api/v1/queue/jobs/{jobId}',
            statusUrl: `/api/v1/queue/jobs/${jobId}`
        });
    } catch (err: any) {
        logger.error(`[QueueController] Error starting PI PDF generation: ${err.message}`);
        next(err);
    }
}

/**
 * Busca status de um job específico
 */
export async function getJobStatus(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const jobId = req.params.jobId as string;

    logger.info(`[QueueController] getJobStatus requisitado para job ${jobId} por empresa ${empresaId}.`);

    try {
        const job = await PiGenJob.findOne({ jobId, empresaId }).lean();

        if (!job) {
            res.status(404).json({
                success: false,
                error: 'Job not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            job: {
                jobId: job.jobId,
                status: job.status,
                progress: job.progress || 0,
                resultPath: job.resultPath,
                resultUrl: job.resultUrl,
                error: job.error,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                whatsappSent: job.whatsappSent,
                whatsappSentAt: job.whatsappSentAt
            }
        });
    } catch (err: any) {
        logger.error(`[QueueController] Error getting job status: ${err.message}`);
        next(err);
    }
}

/**
 * Lista jobs de uma empresa (com paginação)
 */
export async function getJobs(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const { page = 1, limit = 10, status } = req.query;

    logger.info(`[QueueController] getJobs requisitado por empresa ${empresaId}.`);

    try {
        const query: any = { empresaId };
        if (status) {
            query.status = status;
        }

        const jobs = await PiGenJob.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit as string))
            .skip((parseInt(page as string) - 1) * parseInt(limit as string))
            .lean();

        const total = await PiGenJob.countDocuments(query);

        res.status(200).json({
            success: true,
            data: jobs.map(job => ({
                jobId: job.jobId,
                status: job.status,
                progress: job.progress || 0,
                resultPath: job.resultPath,
                resultUrl: job.resultUrl,
                error: job.error,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                whatsappSent: job.whatsappSent,
                whatsappSentAt: job.whatsappSentAt
            })),
            pagination: {
                currentPage: parseInt(page as string),
                totalPages: Math.ceil(total / parseInt(limit as string)),
                totalItems: total,
                itemsPerPage: parseInt(limit as string)
            }
        });
    } catch (err: any) {
        logger.error(`[QueueController] Error getting jobs: ${err.message}`);
        next(err);
    }
}

/**
 * Download do arquivo gerado (fallback para quando o job está completo)
 */
export async function downloadJobResult(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const jobId = req.params.jobId as string;

    logger.info(`[QueueController] downloadJobResult requisitado para job ${jobId} por empresa ${empresaId}.`);

    try {
        const job = await PiGenJob.findOne({ jobId, empresaId });

        if (!job) {
            res.status(404).json({ success: false, error: 'Job not found' });
            return;
        }

        if (job.status !== 'done') {
            res.status(400).json({ success: false, error: 'Job is not completed yet', status: job.status });
            return;
        }

        if (!job.resultPath) {
            res.status(404).json({ success: false, error: 'Result file not found' });
            return;
        }

        // Serve the file
        res.download(job.resultPath, `document-${jobId}.pdf`, (err) => {
            if (err) {
                logger.error(`[QueueController] Error downloading file: ${err.message}`);
                // Don't call next() here as headers might already be sent
            }
        });
    } catch (err: any) {
        logger.error(`[QueueController] Error downloading job result: ${err.message}`);
        next(err);
    }
}

export default {
    generateContratoPDF,
    generatePIPDF,
    getJobStatus,
    getJobs,
    downloadJobResult
};