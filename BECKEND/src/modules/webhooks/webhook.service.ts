/**
 * Webhook Service
 * Integrações via webhooks
 */
// src/modules/webhooks/webhook.service.ts
import axios from 'axios';
import crypto from 'crypto';
import Webhook from './Webhook';
import logger from '../../shared/container/logger';
import type { IWebhook } from '../../types/models';

// ─── Tipos locais ──────────────────────────────────────────────────────────────

/** Dados genéricos de evento — qualquer payload JSON serializable. */
type WebhookEventPayload = Record<string, unknown>;

/** Filtros opcionais para listar webhooks. */
type WebhookFilterOptions = Record<string, unknown>;

/** Dados para criação de um novo webhook. */
interface WebhookCreateData {
    empresa: string;
    nome: string;
    url: string;
    eventos: string[];
    retry_config?: Partial<IWebhook['retry_config']>;
    headers?: Record<string, string>;
}

/** Campos atualizáveis de um webhook. */
type WebhookUpdateData = Partial<Pick<IWebhook,
    'nome' | 'url' | 'eventos' | 'ativo' | 'retry_config' | 'headers'
>>;

/** Payload interno enviado ao endpoint externo. */
interface WebhookDispatchPayload {
    evento: string;
    timestamp: string;
    data: WebhookEventPayload;
    webhook_id: unknown;
}

// ──────────────────────────────────────────────────────────────────────────────

class WebhookService {

    /**
     * Dispara webhook para evento específico.
     */
    async disparar(
        empresaId: string,
        evento: string,
        payload: WebhookEventPayload
    ): Promise<void> {
        try {
            const webhooks = await Webhook.find({
                empresa: empresaId,
                ativo: true,
                eventos: evento
            }).select('+secret');

            if (webhooks.length === 0) {
                logger.debug(`[WebhookService] Nenhum webhook ativo para evento ${evento} na empresa ${empresaId}`);
                return;
            }

            logger.info(`[WebhookService] Disparando ${webhooks.length} webhook(s) para evento: ${evento}`);

            const promises = webhooks.map(webhook => this._dispararWebhook(webhook, evento, payload));
            await Promise.allSettled(promises);

        } catch (error: any) {
            // error.message é seguro aqui — vem do Mongoose ou de erros internos conhecidos
            logger.error(`[WebhookService] Erro ao disparar webhooks: ${error.message}`);
        }
    }

    /**
     * Dispara um webhook individual com retry logic e exponential backoff.
     * @private
     */
    async _dispararWebhook(
        webhook: IWebhook,
        evento: string,
        payload: WebhookEventPayload
    ): Promise<void> {
        const maxTentativas = webhook.retry_config?.max_tentativas || 3;
        const timeout = webhook.retry_config?.timeout_ms || 3000;

        for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
            try {
                const webhookPayload: WebhookDispatchPayload = {
                    evento,
                    timestamp: new Date().toISOString(),
                    data: payload,
                    webhook_id: webhook._id
                };

                const signature = this._gerarAssinatura(webhookPayload, webhook.secret);

                const headers: Record<string, string | number> = {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature,
                    'X-Webhook-Event': evento,
                    'X-Webhook-Tentativa': tentativa,
                    'User-Agent': 'InMidia-Webhook/1.0',
                    ...Object.fromEntries(webhook.headers || [])
                };

                // Axios pode retornar qualquer tipo — não usamos a resposta além do status
                await axios.post(webhook.url, webhookPayload, {
                    headers,
                    timeout,
                    validateStatus: (status) => status >= 200 && status < 300
                });

                await webhook.registrarDisparo(true);
                logger.info(`[WebhookService] ✅ Webhook ${webhook.nome} disparado com sucesso (tentativa ${tentativa})`);
                return;

            } catch (error: any) {
                // Axios errors têm .response com status/statusText — any é justificado aqui
                const detalhes: string = error.response
                    ? `HTTP ${error.response.status}: ${error.response.statusText}`
                    : (error.message ?? 'erro desconhecido');

                logger.warn(`[WebhookService] ⚠️ Falha no webhook ${webhook.nome} (tentativa ${tentativa}/${maxTentativas}): ${detalhes}`);

                if (tentativa === maxTentativas) {
                    await webhook.registrarDisparo(false, detalhes);
                    logger.error(`[WebhookService] ❌ Webhook ${webhook.nome} falhou após ${maxTentativas} tentativas`);
                }

                if (tentativa < maxTentativas) {
                    await this._sleep(Math.pow(2, tentativa) * 1000);
                }
            }
        }
    }

    /**
     * Gera assinatura HMAC-SHA256 para validação do payload.
     * @private
     */
    _gerarAssinatura(payload: WebhookDispatchPayload, secret: string): string {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(JSON.stringify(payload));
        return hmac.digest('hex');
    }

    /**
     * Helper para delay com exponential backoff.
     * @private
     */
    _sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cria novo webhook.
     */
    async criar(dados: WebhookCreateData, userId: string): Promise<Record<string, unknown>> {
        try {
            const secret = crypto.randomBytes(32).toString('hex');

            const webhook = new Webhook({
                ...dados,
                secret,
                criado_por: userId
            });

            await webhook.save();
            logger.info(`[WebhookService] Webhook criado: ${webhook.nome} (${webhook._id})`);

            // toObject() produz um POJO — cast via unknown necessário pois IWebhook
            // e Record<string,unknown> não se sobrepõem na análise estática do TS.
            const webhookObj = webhook.toObject() as unknown as Record<string, unknown>;
            delete webhookObj.secret;

            return webhookObj;
        } catch (error: any) {
            logger.error(`[WebhookService] Erro ao criar webhook: ${error.message}`);
            throw error;
        }
    }

    /**
     * Busca webhooks da empresa com filtros opcionais.
     */
    async listar(empresaId: string, filtros: WebhookFilterOptions = {}): Promise<IWebhook[]> {
        try {
            const query = { empresaId: empresaId, ...filtros };
            const webhooks = await Webhook.find(query)
                .sort({ createdAt: -1 })
                .populate('criado_por', 'username email');

            return webhooks as unknown as IWebhook[];
        } catch (error: any) {
            logger.error(`[WebhookService] Erro ao listar webhooks: ${error.message}`);
            throw error;
        }
    }

    /**
     * Atualiza campos permitidos de um webhook.
     */
    async atualizar(webhookId: string, empresaId: string, dados: WebhookUpdateData): Promise<IWebhook> {
        try {
            const webhook = await Webhook.findOne({ _id: webhookId, empresa: empresaId });

            if (!webhook) {
                throw new Error('Webhook não encontrado');
            }

            // Atualiza apenas os campos declarados em WebhookUpdateData
            const camposPermitidos: Array<keyof WebhookUpdateData> = [
                'nome', 'url', 'eventos', 'ativo', 'retry_config', 'headers'
            ];
            camposPermitidos.forEach(campo => {
                if (dados[campo] !== undefined) {
                    // Mongoose Document não tem index signature — cast via unknown é necessário
                    // pois HydratedDocument e Record não se sobrepõem na análise do TS.
                    (webhook as unknown as Record<string, unknown>)[campo] = dados[campo] as unknown;
                }
            });

            await webhook.save();
            logger.info(`[WebhookService] Webhook atualizado: ${webhook.nome} (${webhook._id})`);

            return webhook as unknown as IWebhook;
        } catch (error: any) {
            logger.error(`[WebhookService] Erro ao atualizar webhook: ${error.message}`);
            throw error;
        }
    }

    /**
     * Remove um webhook pelo ID.
     */
    async remover(webhookId: string, empresaId: string): Promise<boolean> {
        try {
            const resultado = await Webhook.deleteOne({ _id: webhookId, empresa: empresaId });

            if (resultado.deletedCount === 0) {
                throw new Error('Webhook não encontrado');
            }

            logger.info(`[WebhookService] Webhook removido: ${webhookId}`);
            return true;
        } catch (error: any) {
            logger.error(`[WebhookService] Erro ao remover webhook: ${error.message}`);
            throw error;
        }
    }

    /**
     * Regenera o secret de um webhook (exibido apenas uma vez).
     */
    async regenerarSecret(webhookId: string, empresaId: string): Promise<{
        webhook_id: unknown;
        secret: string;
        mensagem: string;
    }> {
        try {
            const webhook = await Webhook.findOne({ _id: webhookId, empresa: empresaId });

            if (!webhook) {
                throw new Error('Webhook não encontrado');
            }

            webhook.secret = crypto.randomBytes(32).toString('hex');
            await webhook.save();

            logger.info(`[WebhookService] Secret regenerado para webhook: ${webhook.nome}`);

            return {
                webhook_id: webhook._id,
                secret: webhook.secret,
                mensagem: 'Secret regenerado com sucesso. Guarde-o em local seguro, não será exibido novamente.'
            };
        } catch (error: any) {
            logger.error(`[WebhookService] Erro ao regenerar secret: ${error.message}`);
            throw error;
        }
    }

    /**
     * Envia payload de teste para um webhook específico.
     */
    async testar(webhookId: string, empresaId: string): Promise<{ sucesso: boolean; mensagem: string }> {
        try {
            const webhook = await Webhook.findOne({ _id: webhookId, empresa: empresaId }).select('+secret');

            if (!webhook) {
                throw new Error('Webhook não encontrado');
            }

            const payloadTeste: WebhookEventPayload = {
                mensagem: 'Este é um webhook de teste',
                teste: true,
                empresa_id: empresaId
            };

            await this._dispararWebhook(webhook as unknown as IWebhook, 'teste', payloadTeste);

            return { sucesso: true, mensagem: 'Webhook de teste enviado' };
        } catch (error: any) {
            logger.error(`[WebhookService] Erro ao testar webhook: ${error.message}`);
            throw error;
        }
    }
}

export default new WebhookService();
