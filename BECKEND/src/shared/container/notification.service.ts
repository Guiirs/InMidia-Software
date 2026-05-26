// src/shared/container/notification.service.ts
import logger from './logger';
import { Server as SocketIOServer } from 'socket.io';

interface NotificationData {
    type: string;
    data: unknown;
    timestamp: string;
}

class NotificationService {
    io: SocketIOServer | null = null;

    constructor() {}

    initialize(io: SocketIOServer): void {
        this.io = io;
        logger.info('[NotificationService] Serviço de notificações inicializado com Socket.IO');
    }

    notifyEmpresa(empresaId: string, type: string, data: unknown): void {
        if (!this.io) {
            logger.warn('[NotificationService] Socket.IO não inicializado. Notificação não enviada.');
            return;
        }

        const room = `empresa_${empresaId}`;
        const notification: NotificationData = {
            type,
            data,
            timestamp: new Date().toISOString()
        };
        this.io.to(room).emit('notification', notification);

        logger.info(`[NotificationService] Notificação enviada para empresa ${empresaId}: ${type}`);
    }

    notifyUser(userId: string, type: string, data: unknown): void {
        if (!this.io) {
            logger.warn('[NotificationService] Socket.IO não inicializado. Notificação não enviada.');
            return;
        }

        const room = `user_${userId}`;
        const notification: NotificationData = {
            type,
            data,
            timestamp: new Date().toISOString()
        };
        this.io.to(room).emit('notification', notification);

        logger.info(`[NotificationService] Notificação enviada para usuário ${userId}: ${type}`);
    }

    notifyAllAdmins(type: string, data: unknown): void {
        if (!this.io) {
            logger.warn('[NotificationService] Socket.IO não inicializado. Notificação não enviada.');
            return;
        }

        const notification: NotificationData = {
            type,
            data,
            timestamp: new Date().toISOString()
        };
        this.io.to('admins').emit('notification', notification);

        logger.info(`[NotificationService] Notificação broadcast enviada para todos os admins: ${type}`);
    }

    static TYPES = {
        PLACA_DISPONIVEL: 'placa_disponivel',
        PLACA_ALUGADA: 'placa_alugada',
        CONTRATO_CRIADO: 'contrato_criado',
        CONTRATO_EXPIRANDO: 'contrato_expirando',
        CONTRATO_EXPIRADO: 'contrato_expirado',
        PI_CRIADA: 'pi_criada',
        PI_APROVADA: 'pi_aprovada',
        CLIENTE_NOVO: 'cliente_novo',
        API_KEY_REGENERADA: 'api_key_regenerada',
        ALUGUEL_CRIADO: 'aluguel_criado',
        ALUGUEL_CANCELADO: 'aluguel_cancelado'
    };
}

export default new NotificationService();
