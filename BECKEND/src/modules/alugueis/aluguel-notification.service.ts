// src/services/aluguelNotificationService.ts
import { Types } from 'mongoose';
import { IAluguel } from '../../types/models.d';
import logger from '@shared/container/logger';
import notificationService from '@shared/container/notification.service';
import webhookService from '@modules/webhooks/webhook.service';
import * as sseController from '@modules/system/sse/sse.controller';

const NOTIFICATION_TYPES = {
  ALUGUEL_CRIADO: 'aluguel_criado',
  ALUGUEL_CANCELADO: 'aluguel_cancelado',
} as const;

class AluguelNotificationService {
  private formatNotificationData(aluguel: IAluguel, placaNumero?: string, clienteNome?: string) {
    return {
      aluguel_id: aluguel._id.toString(),
      placa:
        placaNumero ||
        (typeof aluguel.placaId === 'object' && 'numero_placa' in aluguel.placaId
          ? aluguel.placaId.numero_placa
          : aluguel.placaId.toString()),
      cliente:
        clienteNome ||
        (typeof aluguel.clienteId === 'object' && 'nome' in aluguel.clienteId
          ? aluguel.clienteId.nome
          : 'Cliente'),
      data_inicio: aluguel.startDate || aluguel.data_inicio,
      data_fim: aluguel.endDate || aluguel.data_fim,
      periodo_tipo: aluguel.periodType,
    };
  }

  private async notifyWebSocket(empresaId: string, eventType: string, data: any): Promise<void> {
    try {
      notificationService.notifyEmpresa(empresaId, eventType, data);
      logger.debug(`[AluguelNotificationService] WebSocket notificado: ${eventType}`);
    } catch (error: any) {
      logger.error(`[AluguelNotificationService] Erro ao notificar via WebSocket: ${error.message}`);
    }
  }

  private async notifySSE(empresaId: string, eventType: string, data: any): Promise<void> {
    try {
      sseController.notificarEmpresa(empresaId, eventType, data);
      logger.debug(`[AluguelNotificationService] SSE notificado: ${eventType}`);
    } catch (error: any) {
      logger.error(`[AluguelNotificationService] Erro ao notificar via SSE: ${error.message}`);
    }
  }

  private async notifyWebhook(empresaId: string, eventType: string, data: any): Promise<void> {
    try {
      await webhookService.disparar(empresaId, eventType, data);
      logger.debug(`[AluguelNotificationService] Webhook disparado: ${eventType}`);
    } catch (error: any) {
      logger.error(`[AluguelNotificationService] Erro ao disparar webhook: ${error.message}`);
    }
  }

  async notifyAluguelCriado(
    aluguel: IAluguel,
    empresaId: Types.ObjectId,
    placaNumero?: string,
    clienteNome?: string
  ): Promise<void> {
    logger.info(`[AluguelNotificationService] Disparando notificacoes para aluguel ${aluguel._id}`);

    const empresaIdStr = empresaId.toString();
    const notificacaoData = this.formatNotificationData(aluguel, placaNumero, clienteNome);

    const promises = [
      this.notifyWebSocket(empresaIdStr, NOTIFICATION_TYPES.ALUGUEL_CRIADO, notificacaoData),
      this.notifySSE(empresaIdStr, 'aluguel_criado', notificacaoData),
      this.notifyWebhook(empresaIdStr, 'aluguel_criado', notificacaoData),
    ];

    await Promise.allSettled(promises);
    logger.info(`[AluguelNotificationService] Notificacoes concluidas para aluguel ${aluguel._id}`);
  }

  async notifyAluguelCancelado(
    aluguelId: string,
    empresaId: Types.ObjectId,
    placaNumero?: string,
    clienteNome?: string
  ): Promise<void> {
    logger.info(`[AluguelNotificationService] Disparando notificacoes de cancelamento para ${aluguelId}`);

    const empresaIdStr = empresaId.toString();
    const notificacaoData = {
      aluguel_id: aluguelId,
      placa: placaNumero || 'Desconhecida',
      cliente: clienteNome || 'Desconhecido',
    };

    const promises = [
      this.notifyWebSocket(empresaIdStr, NOTIFICATION_TYPES.ALUGUEL_CANCELADO, notificacaoData),
      this.notifySSE(empresaIdStr, 'aluguel_cancelado', notificacaoData),
      this.notifyWebhook(empresaIdStr, 'aluguel_cancelado', notificacaoData),
    ];

    await Promise.allSettled(promises);
    logger.info(
      `[AluguelNotificationService] Notificacoes de cancelamento concluidas para ${aluguelId}`
    );
  }
}

export default new AluguelNotificationService();
