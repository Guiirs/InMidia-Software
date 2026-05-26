/**
 * Queue Service - WhatsApp Integration
 * Envia PDFs via WhatsApp para clientes
 */

import logger from '../../container/logger';
import PiGenJob from '../../../models/PiGenJob';
import whatsappService from '../../../modules/whatsapp/whatsapp.service';

/**
 * Envia PDF via WhatsApp para o cliente
 */
export async function sendPDFViaWhatsApp(
  jobId: string,
  entityId: string,
  entityType: string,
  pdfPath: string
): Promise<void> {
  try {
    let cliente: any;
    let entity: any;

    if (entityType === 'contrato') {
      // Get contract details to find client phone number
      const Contrato = (await import('../../../modules/contratos/Contrato')).default;
      entity = await Contrato.findById(entityId).populate('clienteId', 'nome telefone whatsapp').lean();

      if (!entity) {
        throw new Error(`Contract ${entityId} not found`);
      }

      if (!entity) {
        throw new Error(`Contract ${entityId} not found`);
      }
      
      cliente = entity.clienteId as any;
      if (!cliente) {
        throw new Error(`Client not found or not populated for contract ${entityId}`);
      }
    } else if (entityType === 'pi') {
      // Get PI details to find client phone number
      const PI = (await import('../../../modules/propostas-internas/PropostaInterna')).default;
      entity = await PI.findById(entityId).populate('clienteId', 'nome telefone whatsapp').lean();

      if (!entity) {
        throw new Error(`PI ${entityId} not found`);
      }

      cliente = entity.clienteId as any;
      if (!cliente) {
        throw new Error(`Client not found or not populated for PI ${entityId}`);
      }
    } else {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }

    const phoneNumber = cliente.whatsapp || cliente.telefone;
    if (!phoneNumber) {
      throw new Error(`No phone number found for client ${cliente.nome}`);
    }

    // Format phone number for WhatsApp (remove spaces, add country code if needed)
    const defaultCountryCode = process.env.WHATSAPP_COUNTRY_CODE || '+351';
    const formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/^(\+?\d{1,3})?/, defaultCountryCode);

    // Send PDF via WhatsApp
    const success = await whatsappService.sendPDFToClient(formattedPhone, pdfPath, entity);

    if (!success) {
      throw new Error('WhatsApp service returned false');
    }

    // Update job status to indicate WhatsApp was sent
    await PiGenJob.findOneAndUpdate(
      { jobId },
      {
        status: 'sent_whatsapp',
        whatsappSent: true,
        whatsappSentAt: new Date(),
        updatedAt: new Date()
      }
    );

    logger.info(`[QueueService] PDF sent via WhatsApp for job ${jobId} to ${formattedPhone}`);

  } catch (error: any) {
    logger.error(`[QueueService] Failed to send PDF via WhatsApp for job ${jobId}: ${error.message}`);
    throw error;
  }
}
