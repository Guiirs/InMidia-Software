// scripts/whatsappDailyReport.ts
import cron from 'node-cron';
import logger from '../shared/container/logger';
import whatsappService from '../modules/whatsapp/whatsapp.service';
import Empresa from '../modules/empresas/Empresa';

/**
 * Configura envio diário de relatórios WhatsApp
 * Horário configurável via variável de ambiente WHATSAPP_REPORT_HOUR
 */
export function scheduleWhatsAppReports(): void {
    // Pega hora configurada ou usa 09:00 como padrão
    const reportHour = process.env.WHATSAPP_REPORT_HOUR || '09:00';
    const [hour, minute] = reportHour.split(':');

    // Valida hora
    if (!hour || !minute || parseInt(hour) > 23 || parseInt(minute) > 59) {
        logger.error(`[WhatsApp Cron] Hora inválida: ${reportHour}. Use formato HH:MM`);
        return;
    }

    // Cron expression: minuto hora * * *  (todos os dias)
    const cronExpression = `${minute} ${hour} * * *`;
    
    logger.info(`[WhatsApp Cron] ⏰ Agendando relatórios diários para ${reportHour}`);
    logger.info(`[WhatsApp Cron] Cron expression: ${cronExpression}`);

    // Agenda tarefa — itera por empresa (Empresa é modelo global)
    cron.schedule(cronExpression, async () => {
        try {
            logger.info('[WhatsApp Cron] 🚀 Executando envio de relatório diário...');
            const empresas = await Empresa.find({}).select('_id').lean();
            let enviados = 0;
            for (const emp of empresas) {
                const empresaId = String(emp._id);
                try {
                    const sucesso = await whatsappService.enviarRelatorioDisponibilidade(null, empresaId);
                    if (sucesso) enviados++;
                } catch (empErr: any) {
                    logger.warn(`[WhatsApp Cron] Falha para empresa ${empresaId}: ${empErr.message}`);
                }
            }
            logger.info(`[WhatsApp Cron] ✅ Relatórios enviados: ${enviados}/${empresas.length}`);
        } catch (error) {
            const err = error as Error;
            logger.error(`[WhatsApp Cron] ❌ Erro ao enviar relatório: ${err.message}`);
        }
    }, {
        timezone: process.env.TZ || 'Europe/Lisbon'
    });

    logger.info('[WhatsApp Cron] ✅ Cron job de relatórios WhatsApp configurado!');
    logger.info(`[WhatsApp Cron] Próximo envio: ${reportHour} (${process.env.TZ || 'Europe/Lisbon'})`);
}

/**
 * Envia relatório sob demanda (para testes)
 */
export async function enviarRelatorioAgora(empresaId: string): Promise<boolean> {
    if (!empresaId) throw new Error('[WhatsApp] empresaId é obrigatório para enviarRelatorioAgora()');
    try {
        logger.info(`[WhatsApp] Enviando relatório sob demanda para empresa ${empresaId}...`);
        const sucesso = await whatsappService.enviarRelatorioDisponibilidade(null, empresaId);

        if (sucesso) {
            logger.info('[WhatsApp] ✅ Relatório enviado!');
        } else {
            logger.error('[WhatsApp] ❌ Falha ao enviar relatório');
        }

        return sucesso;
    } catch (error) {
        const err = error as Error;
        logger.error(`[WhatsApp] Erro: ${err.message}`);
        return false;
    }
}
