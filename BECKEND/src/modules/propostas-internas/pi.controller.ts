/**
 * PI Controller
 * Endpoints de propostas internas
 */
// src/modules/propostas-internas/pi.controller.ts
import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express';
import PIService from './pi.service';
import logger from '@shared/container/logger';
import { defaultAuditService } from '@modules/audit/audit.service';
import { auditRequestContext } from '@modules/audit/audit.helpers';

// IAuthRequest herda de Express.Request (namespace), não de Request (classe HTTP).
// AuthReq garante que params/body/query estão disponíveis nos handlers.
type AuthReq = Request & IAuthRequest;

const piService = new PIService();

/**
 * Cria PI
 */
export async function createPI(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    logger.info(`[PiController] createPI requisitado por empresa ${empresaId}.`);
    logger.debug(`[PiController] req.body recebido: ${JSON.stringify(req.body, null, 2)}`);
    logger.debug(`[PiController] Placas recebidas: ${JSON.stringify(req.body.placas)}`);
    
    try {
        const piData = { ...req.body, cliente: req.body.clienteId };
        logger.debug(`[PiController] piData que será enviado ao service: ${JSON.stringify(piData, null, 2)}`);
        
        const novaPI = await piService.create(piData, empresaId);
        
        logger.info(`[PiController] PI criada com sucesso. ID: ${novaPI._id}, Placas: ${novaPI.placas?.length || 0}`);
        void defaultAuditService.recordEntityCreated({
            ...auditRequestContext(req),
            module: 'propostas',
            entityType: 'proposta_interna',
            entityId: String(novaPI._id || ''),
            entityLabel: String((novaPI as any).pi_code || (novaPI as any).codigo || ''),
            after: novaPI,
            metadata: {
                clienteId: req.body?.clienteId,
                placasCount: Array.isArray(req.body?.placas) ? req.body.placas.length : 0,
            },
        });
        
        res.status(201).json(novaPI);
    } catch (err: any) {
        logger.error(`[PiController] Erro ao criar PI: ${err.message}`, { stack: err.stack });
        next(err);
    }
}

/**
 * Lista PIs
 */
export async function getAllPIs(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    logger.info(`[PiController] getAllPIs requisitado por empresa ${empresaId}.`);
    try {
        const result = await piService.getAll(empresaId, req.query);
        res.status(200).json(result);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Busca PI por ID
 */
export async function getPIById(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const id = req.params.id as string;
    logger.info(`[PiController] getPIById ${id} requisitado por empresa ${empresaId}.`);
    try {
        const pi = await piService.getById(id, empresaId);
        res.status(200).json(pi);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Atualiza PI
 */
export async function updatePI(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const id = req.params.id as string;
    logger.info(`[PiController] updatePI ${id} requisitado por empresa ${empresaId}.`);
    try {
        const piData = { ...req.body, cliente: req.body.clienteId };
        const piAtualizada = await piService.update(id, piData, empresaId);
        void defaultAuditService.recordEntityUpdated({
            ...auditRequestContext(req),
            module: 'propostas',
            entityType: 'proposta_interna',
            entityId: String(id),
            entityLabel: String((piAtualizada as any).pi_code || (piAtualizada as any).codigo || ''),
            after: piAtualizada,
            metadata: { changedFields: Object.keys(req.body || {}) },
        });
        res.status(200).json(piAtualizada);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Deleta PI
 */
export async function deletePI(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const id = req.params.id as string;
    logger.info(`[PiController] deletePI ${id} requisitado por empresa ${empresaId}.`);
    try {
        await piService.delete(id, empresaId);
        void defaultAuditService.recordEntityDeleted({
            ...auditRequestContext(req),
            module: 'propostas',
            entityType: 'proposta_interna',
            entityId: String(id),
        });
        res.status(204).send();
    } catch (err: any) {
        next(err);
    }
}

/**
 * Download PDF da PI
 */
export async function downloadPI_PDF(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const userId = (req.user as any).id;
    const id = req.params.id as string;
    logger.info(`[PiController] downloadPI_PDF ${id} requisitado por user ${userId} (Empresa ${empresaId}).`);
    try {
        await piService.generatePDF(id, empresaId, userId, res);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Download Excel da PI
 */
export async function downloadPI_Excel(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const id = req.params.id as string;
    logger.info(`[PiController] downloadPI_Excel ${id} requisitado por empresa ${empresaId}.`);
    try {
        await piService.generateExcel(id, empresaId, res);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Download PDF da PI (convertido do Excel)
 */
export async function downloadPI_PDF_FromExcel(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const id = req.params.id as string;
    logger.info(`[PiController] downloadPI_PDF_FromExcel ${id} requisitado por empresa ${empresaId}.`);
    try {
        await piService.generatePDFFromExcel(id, empresaId, res);
    } catch (err: any) {
        next(err);
    }
}

/**
 * Aprova PI
 */
export async function approvePI(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const userId    = (req.user as any).id;
    const id = req.params.id as string;
    logger.info(`[PiController] approvePI ${id} por user ${userId} (empresa ${empresaId})`);
    try {
        const pi = await piService.approve(id, empresaId, userId);
        void defaultAuditService.recordEntityUpdated({
            ...auditRequestContext(req),
            module: 'propostas',
            entityType: 'proposta_interna',
            entityId: id,
            entityLabel: String((pi as any).pi_code || ''),
            after: pi,
            metadata: { action: 'approve' },
        });
        res.status(200).json(pi);
    } catch (err) { next(err); }
}

/**
 * Rejeita PI
 */
export async function rejectPI(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const userId    = (req.user as any).id;
    const id = req.params.id as string;
    logger.info(`[PiController] rejectPI ${id} por user ${userId} (empresa ${empresaId})`);
    try {
        const pi = await piService.reject(id, empresaId, userId);
        void defaultAuditService.recordEntityUpdated({
            ...auditRequestContext(req),
            module: 'propostas',
            entityType: 'proposta_interna',
            entityId: id,
            entityLabel: String((pi as any).pi_code || ''),
            after: pi,
            metadata: { action: 'reject' },
        });
        res.status(200).json(pi);
    } catch (err) { next(err); }
}

/**
 * Cancela PI
 */
export async function cancelPI(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const userId    = (req.user as any).id;
    const id = req.params.id as string;
    logger.info(`[PiController] cancelPI ${id} por user ${userId} (empresa ${empresaId})`);
    try {
        const pi = await piService.cancel(id, empresaId, userId);
        void defaultAuditService.recordEntityUpdated({
            ...auditRequestContext(req),
            module: 'propostas',
            entityType: 'proposta_interna',
            entityId: id,
            entityLabel: String((pi as any).pi_code || ''),
            after: pi,
            metadata: { action: 'cancel' },
        });
        res.status(200).json(pi);
    } catch (err) { next(err); }
}

/**
 * Gera contrato a partir de PI APPROVED
 */
export async function generateContractFromPI(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const id = req.params.id as string;
    logger.info(`[PiController] generateContractFromPI ${id} (empresa ${empresaId})`);
    try {
        const contrato = await piService.generateContractFromPI(id, empresaId);
        res.status(201).json(contrato);
    } catch (err) { next(err); }
}

/**
 * Verifica disponibilidade de placas para um período
 */
export async function checkAvailability(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    logger.info(`[PiController] checkAvailability (empresa ${empresaId})`);
    try {
        const body = req.body as { startDate?: string; endDate?: string; regionId?: string; excludePiId?: string };
        const result = await piService.checkAvailability(
            {
                startDate:   body.startDate   || '',
                endDate:     body.endDate     || '',
                regionId:    body.regionId,
                excludePiId: body.excludePiId,
            },
            empresaId
        );
        res.status(200).json(result);
    } catch (err) { next(err); }
}

export default {
    createPI,
    getAllPIs,
    getPIById,
    updatePI,
    deletePI,
    approvePI,
    rejectPI,
    cancelPI,
    generateContractFromPI,
    checkAvailability,
    downloadPI_PDF,
    downloadPI_Excel,
    downloadPI_PDF_FromExcel
};
