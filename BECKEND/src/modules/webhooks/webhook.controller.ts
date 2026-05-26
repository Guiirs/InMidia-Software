/**
 * Webhook Controller
 * Endpoints para webhooks
 */
// src/modules/webhooks/webhook.controller.ts
import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express';
import webhookService from './webhook.service';
import logger from '../../shared/container/logger';
import AppError from '../../shared/container/AppError';

// IAuthRequest herda de Express.Request (namespace) — não tem params/body/query.
// AuthReq combina Request (classe HTTP) com a extensão de autenticação.
type AuthReq = Request & IAuthRequest;

/**
 * Lista todos os webhooks da empresa
 */
export async function listarWebhooks(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const empresaId = (req.user as any).empresaId;
        const { ativo } = req.query;

        const filtros: any = {};
        if (ativo !== undefined) {
            filtros.ativo = ativo === 'true';
        }

        const webhooks = await webhookService.listar(empresaId, filtros);

        res.status(200).json({
            sucesso: true,
            total: webhooks.length,
            webhooks
        });
    } catch (error: any) {
        logger.error(`[WebhookController] Erro ao listar webhooks: ${error.message}`);
        next(error);
    }
}

/**
 * Cria novo webhook
 */
export async function criarWebhook(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const empresaId = (req.user as any).empresaId;
        const userId = (req.user as any).id;
        const { nome, url, eventos, retry_config, headers } = req.body;

        const webhook = await webhookService.criar({
            empresa: empresaId,
            nome,
            url,
            eventos,
            retry_config,
            headers
        }, userId);

        logger.info(`[WebhookController] Webhook criado por usuário ${userId}: ${webhook.nome}`);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Webhook criado com sucesso',
            webhook
        });
    } catch (error: any) {
        logger.error(`[WebhookController] Erro ao criar webhook: ${error.message}`);
        next(error);
    }
}

/**
 * Atualiza webhook existente
 */
export async function atualizarWebhook(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const empresaId = (req.user as any).empresaId;
        const webhookId = req.params.webhookId as string;
        const dados = req.body;

        const webhook = await webhookService.atualizar(webhookId, empresaId, dados);

        logger.info(`[WebhookController] Webhook atualizado: ${webhook.nome}`);

        res.status(200).json({
            sucesso: true,
            mensagem: 'Webhook atualizado com sucesso',
            webhook
        });
    } catch (error: any) {
        logger.error(`[WebhookController] Erro ao atualizar webhook: ${error.message}`);
        next(error);
    }
}

/**
 * Remove webhook
 */
export async function removerWebhook(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const empresaId = (req.user as any).empresaId;
        const webhookId = req.params.webhookId as string;

        await webhookService.remover(webhookId, empresaId);

        logger.info(`[WebhookController] Webhook removido: ${webhookId}`);

        res.status(200).json({
            sucesso: true,
            mensagem: 'Webhook removido com sucesso'
        });
    } catch (error: any) {
        logger.error(`[WebhookController] Erro ao remover webhook: ${error.message}`);
        next(error);
    }
}

/**
 * Regenera secret do webhook
 */
export async function regenerarSecret(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const empresaId = (req.user as any).empresaId;
        const webhookId = req.params.webhookId as string;

        const resultado = await webhookService.regenerarSecret(webhookId, empresaId);

        logger.info(`[WebhookController] Secret regenerado para webhook: ${webhookId}`);

        res.status(200).json({
            sucesso: true,
            ...resultado
        });
    } catch (error: any) {
        logger.error(`[WebhookController] Erro ao regenerar secret: ${error.message}`);
        next(error);
    }
}

/**
 * Testa webhook
 */
export async function testarWebhook(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const empresaId = (req.user as any).empresaId;
        const webhookId = req.params.webhookId as string;

        await webhookService.testar(webhookId, empresaId);

        res.status(200).json({
            sucesso: true,
            mensagem: 'Webhook de teste enviado com sucesso'
        });
    } catch (error: any) {
        logger.error(`[WebhookController] Erro ao testar webhook: ${error.message}`);
        next(error);
    }
}

/**
 * Busca detalhes de um webhook específico
 */
export async function buscarWebhook(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const empresaId = (req.user as any).empresaId;
        const webhookId = req.params.webhookId as string;

        const webhooks = await webhookService.listar(empresaId, { _id: webhookId });

        if (webhooks.length === 0) {
            throw new AppError('Webhook não encontrado', 404);
        }

        res.status(200).json({
            sucesso: true,
            webhook: webhooks[0]
        });
    } catch (error: any) {
        logger.error(`[WebhookController] Erro ao buscar webhook: ${error.message}`);
        next(error);
    }
}

export default {
    listarWebhooks,
    criarWebhook,
    atualizarWebhook,
    removerWebhook,
    regenerarSecret,
    testarWebhook,
    buscarWebhook
};

