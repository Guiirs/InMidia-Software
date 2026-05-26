import { Schema } from 'mongoose';
import { ICliente } from '../../types/models';

export const clienteSchema = new Schema<ICliente>(
  {
    // ── V4.1 canonical fields ────────────────────────────────────────────────
    tipoPessoa: {
      type: String,
      enum: ['PF', 'PJ'],
    },
    documento: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    nomeFantasia: {
      type: String,
      trim: true,
      maxlength: [200, 'Nome fantasia deve ter no máximo 200 caracteres'],
    },
    whatsapp: {
      type: String,
      trim: true,
    },
    observacoes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Observações devem ter no máximo 2000 caracteres'],
    },
    tags: {
      type: [String],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    archivedAt: {
      type: Date,
    },
    archivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // ── Core fields ──────────────────────────────────────────────────────────
    nome: {
      type: String,
      required: [true, 'O nome do cliente é obrigatório'],
      trim: true,
      maxlength: [200, 'Nome deve ter no máximo 200 caracteres'],
    },
    responsavel: {
      type: String,
      trim: true,
      maxlength: [200, 'Nome do responsável deve ter no máximo 200 caracteres'],
    },
    segmento: {
      type: String,
      trim: true,
      maxlength: [100, 'Segmento deve ter no máximo 100 caracteres'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido'],
    },
    telefone: {
      type: String,
      trim: true,
    },
    endereco: {
      type: String,
      trim: true,
    },
    cidade: {
      type: String,
      trim: true,
    },
    estado: {
      type: String,
      trim: true,
      maxlength: [2, 'Estado deve ter 2 caracteres (UF)'],
    },
    cep: {
      type: String,
      trim: true,
    },
    // ── Legacy / backward compat ──────────────────────────────────────────────
    cpfCnpj: {
      type: String,
      trim: true,
      index: true,
    },
    ativo: {
      type: Boolean,
      default: true,
      index: true,
    },
    logo_url: {
      type: String,
      trim: true,
    },
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'O cliente deve pertencer a uma empresa'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual id
clienteSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});

// Virtual para compatibilidade com código legado
clienteSchema.virtual('empresa').get(function (this: any) {
  return this.empresaId;
});

// Compound index: documento único por empresa (V4.1 canonical)
clienteSchema.index({ empresaId: 1, documento: 1 }, { unique: true, sparse: true });

// Compound index: cpfCnpj único por empresa (legacy compat)
clienteSchema.index({ empresaId: 1, cpfCnpj: 1 }, { unique: true, sparse: true });

// Text index para busca
clienteSchema.index({
  nome: 'text',
  responsavel: 'text',
  email: 'text',
});
