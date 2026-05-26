// src/services/whatsappService.js
import apiClient from './apiClient';

/**
 * Serviço para integração com WhatsApp
 */
class WhatsAppService {
  /**
   * Obtém status completo do WhatsApp
   */
  async getStatus() {
    const response = await apiClient.get('/whatsapp/status');
    return response.data;
  }

  /**
   * Obtém QR code atual
   */
  async getQrCode() {
    const response = await apiClient.get('/whatsapp/qr');
    return response.data;
  }

  /**
   * Reconecta o cliente WhatsApp
   */
  async reconnect() {
    const response = await apiClient.post('/whatsapp/reconectar');
    return response.data;
  }

  /**
   * Envia relatório manualmente
   */
  async sendReport() {
    const response = await apiClient.post('/whatsapp/enviar-relatorio');
    return response.data;
  }

  /**
   * Envia mensagem customizada
   */
  async sendMessage(message) {
    const response = await apiClient.post('/whatsapp/enviar-mensagem', { mensagem: message });
    return response.data;
  }

  /**
   * Lista grupos disponíveis
   */
  async listGroups() {
    const response = await apiClient.get('/whatsapp/grupos');
    return response.data;
  }
}

export default new WhatsAppService();