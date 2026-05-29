/**
 * WhatsApp Controller
 * Endpoints para gerenciar conexão WhatsApp
 */

import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express';
import whatsappService from './whatsapp.service';
import logger from '../../shared/container/logger';

// IAuthRequest (namespace) não tem params/body/query — AuthReq combina com Request.
type AuthReq = Request & IAuthRequest;

/**
 * Obtém status completo do cliente WhatsApp
 */
export async function getStatus(_req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const status = whatsappService.getStatus();

        res.status(200).json({
            sucesso: true,
            status: {
                conectado: status.isReady,
                numero_conectado: status.connectedNumber,
                qr_code: status.currentQr,
                grupo_configurado: !!status.groupId,
                grupo_id: status.groupId,
                tentativas_reconexao: status.reconnectAttempts,
                max_tentativas_reconexao: status.maxReconnectAttempts
            }
        });
    } catch (error: any) {
        logger.error(`[WhatsAppController] Erro ao obter status: ${error.message}`);
        next(error);
    }
}

/**
 * Obtém QR code atual
 */
export async function getQrCode(_req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const status = whatsappService.getStatus();

        if (!status.currentQr) {
            res.status(404).json({
                sucesso: false,
                mensagem: 'Nenhum QR code disponível. O WhatsApp pode já estar conectado.'
            });
            return;
        }

        res.status(200).json({
            sucesso: true,
            qr_code: status.currentQr,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        logger.error(`[WhatsAppController] Erro ao obter QR code: ${error.message}`);
        next(error);
    }
}

/**
 * Envia relatório manualmente
 */
export async function enviarRelatorio(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        logger.info(`[WhatsAppController] Usuário ${(req.user as any).username} solicitou envio de relatório`);

        if (!whatsappService.isReady) {
            res.status(503).json({
                sucesso: false,
                mensagem: 'WhatsApp não está conectado. Aguarde a conexão ou escaneie o QR Code.'
            });
            return;
        }

        const empresaId = String((req.user as any)?.empresaId || '');
        if (!empresaId) {
            res.status(400).json({ sucesso: false, mensagem: 'empresaId é obrigatório para enviar relatório' });
            return;
        }
        const sucesso = await whatsappService.enviarRelatorioDisponibilidade(null, empresaId);

        if (sucesso) {
            res.status(200).json({
                sucesso: true,
                mensagem: 'Relatório enviado com sucesso!'
            });
        } else {
            res.status(500).json({
                sucesso: false,
                mensagem: 'Falha ao enviar relatório. Verifique os logs.'
            });
        }
    } catch (error: any) {
        logger.error(`[WhatsAppController] Erro ao enviar relatório: ${error.message}`);
        next(error);
    }
}

/**
 * Envia mensagem customizada
 */
export async function enviarMensagem(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        const { mensagem } = req.body;

        if (!mensagem || mensagem.trim().length === 0) {
            res.status(400).json({
                sucesso: false,
                mensagem: 'Mensagem é obrigatória'
            });
            return;
        }

        logger.info(`[WhatsAppController] Usuário ${(req.user as any).username} enviando mensagem customizada`);

        if (!whatsappService.isReady) {
            res.status(503).json({
                sucesso: false,
                mensagem: 'WhatsApp não está conectado.'
            });
            return;
        }

        const sucesso = await whatsappService.enviarMensagem(mensagem);

        if (sucesso) {
            res.status(200).json({
                sucesso: true,
                mensagem: 'Mensagem enviada com sucesso!'
            });
        } else {
            res.status(500).json({
                sucesso: false,
                mensagem: 'Falha ao enviar mensagem.'
            });
        }
    } catch (error: any) {
        logger.error(`[WhatsAppController] Erro ao enviar mensagem: ${error.message}`);
        next(error);
    }
}

/**
 * Reconecta o cliente WhatsApp
 */
export async function reconectar(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        logger.info(`[WhatsAppController] Usuário ${(req.user as any).username} solicitou reconexão`);

        await whatsappService.destroy();
        await whatsappService.initialize();

        res.status(200).json({
            sucesso: true,
            mensagem: 'Reconexão iniciada. Verifique os logs para o QR Code se necessário.'
        });
    } catch (error: any) {
        logger.error(`[WhatsAppController] Erro ao reconectar: ${error.message}`);
        next(error);
    }
}

/**
 * Lista grupos disponíveis
 */
export async function listarGrupos(_req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
        if (!whatsappService.isReady || !whatsappService.client) {
            res.status(503).json({
                sucesso: false,
                mensagem: 'WhatsApp não está conectado.'
            });
            return;
        }

        const chats = await whatsappService.client.getChats();
        const grupos = chats
            .filter((chat: any) => chat.isGroup)
            .map((group: any) => ({
                id: group.id._serialized,
                nome: group.name,
                participantes: group.participants?.length || 0
            }));

        res.status(200).json({
            sucesso: true,
            total: grupos.length,
            grupos
        });
    } catch (error: any) {
        logger.error(`[WhatsAppController] Erro ao listar grupos: ${error.message}`);
        next(error);
    }
}

export default {
    getStatus,
    enviarRelatorio,
    enviarMensagem,
    reconectar,
    listarGrupos
};

