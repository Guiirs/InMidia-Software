import { Schema } from 'mongoose';
import { IEmpresa } from '../../types/models';
import crypto from 'crypto';

export interface IApiKeyHistory {
  regenerated_by: Schema.Types.ObjectId;
  regenerated_at: Date;
  ip_address?: string;
  user_agent?: string;
}

export const empresaSchema = new Schema<IEmpresa>(
  {
    nome: {
      type: String,
      required: [true, 'O nome da empresa é obrigatório'],
      trim: true,
      maxlength: [200, 'Nome deve ter no máximo 200 caracteres'],
    },
    cnpj: {
      type: String,
      required: [true, 'O CNPJ é obrigatório'],
      unique: true,
      trim: true,
      index: true,
    },
    telefone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    endereco: {
      type: String,
      trim: true,
    },
    ativo: {
      type: Boolean,
      default: true,
      index: true,
    },
    apiKey: {
      type: String,
      unique: true,
    },
    api_key_hash: {
      type: String,
    },
    api_key_prefix: {
      type: String,
    },
    enforce_bi_week_validation: {
      type: Boolean,
      default: false,
      index: true,
    },
    api_key_last_used_at: {
      type: Date,
    },
    api_key_history: [
      {
        regenerated_by: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        regenerated_at: {
          type: Date,
          default: Date.now,
          required: true,
        },
        ip_address: {
          type: String,
          trim: true,
        },
        user_agent: {
          type: String,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual id
empresaSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Pre-save hook to generate API key
empresaSchema.pre('save', function (next) {
  if (!this.apiKey) {
    this.apiKey = crypto.randomBytes(20).toString('hex');
  }
  next();
});
