import { Schema } from 'mongoose';
import { IWebhook } from '../../types/models';

/**
 * Schema para Webhooks
 * Permite empresas registrarem URLs para receber notificações de eventos
 */
export const webhookSchema = new Schema<IWebhook>(
  {
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'Webhook deve pertencer a uma empresa'],
      index: true,
    },

    nome: {
      type: String,
      required: [true, 'Nome do webhook é obrigatório'],
      trim: true,
      maxlength: [100, 'Nome não pode exceder 100 caracteres'],
    },

    url: {
      type: String,
      required: [true, 'URL do webhook é obrigatória'],
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'URL deve começar com http:// ou https://',
      },
    },

    // Eventos que este webhook deve ouvir
    eventos: [
      {
        type: String,
        enum: [
          'placa_disponivel',
          'placa_alugada',
          'contrato_criado',
          'contrato_expirando',
          'contrato_expirado',
          'pi_criada',
          'pi_aprovada',
          'cliente_novo',
          'aluguel_criado',
          'aluguel_cancelado',
        ],
      },
    ],

    // Status do webhook
    ativo: {
      type: Boolean,
      default: true,
    },

    // Secret para validar requisições (HMAC)
    secret: {
      type: String,
      required: true,
      select: false, // Não retorna por padrão
    },

    // Configurações de retry
    retry_config: {
      max_tentativas: {
        type: Number,
        default: 3,
        min: 1,
        max: 5,
      },
      timeout_ms: {
        type: Number,
        default: 5000,
        min: 1000,
        max: 30000,
      },
    },

    // Headers customizados (ex: Authorization)
    headers: {
      type: Map,
      of: String,
      default: new Map(),
    },

    // Estatísticas
    estatisticas: {
      total_disparos: {
        type: Number,
        default: 0,
      },
      sucessos: {
        type: Number,
        default: 0,
      },
      falhas: {
        type: Number,
        default: 0,
      },
      ultimo_disparo: {
        type: Date,
      },
      ultimo_sucesso: {
        type: Date,
      },
      ultima_falha: {
        type: Date,
      },
      ultima_falha_detalhes: {
        type: String,
      },
    },

    // Auditoria
    criado_por: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices compostos
webhookSchema.index({ empresaId: 1, ativo: 1 });
webhookSchema.index({ empresaId: 1, eventos: 1 });

// Virtual para compatibilidade com código legado
webhookSchema.virtual('empresa').get(function(this: any) {
  return this.empresaId;
});

// Virtual id
webhookSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});
