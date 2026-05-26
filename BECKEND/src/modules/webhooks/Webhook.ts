import mongoose, { Model } from 'mongoose';
import { IWebhook } from '../../types/models';
import { webhookSchema } from '../../database/schemas/webhook.schema';

// Método para incrementar estatísticas
webhookSchema.methods.registrarDisparo = function (
  this: IWebhook,
  sucesso: boolean,
  detalhes: string | null = null
): Promise<IWebhook> {
  this.estatisticas.total_disparos += 1;
  this.estatisticas.ultimo_disparo = new Date();

  if (sucesso) {
    this.estatisticas.sucessos += 1;
    this.estatisticas.ultimo_sucesso = new Date();
  } else {
    this.estatisticas.falhas += 1;
    this.estatisticas.ultima_falha = new Date();
    this.estatisticas.ultima_falha_detalhes = detalhes || undefined;
  }

  return this.save();
};

// Método para verificar se webhook escuta determinado evento
webhookSchema.methods.escutaEvento = function (this: IWebhook, evento: string): boolean {
  return this.ativo && this.eventos.includes(evento);
};

const Webhook: Model<IWebhook> = mongoose.models.Webhook || mongoose.model<IWebhook>('Webhook', webhookSchema);

export default Webhook;
