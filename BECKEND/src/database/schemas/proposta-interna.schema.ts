import { Schema } from 'mongoose';
import { IPropostaInterna } from '../../types/models';
import { createPeriodSchema } from '../../utils/periodTypes';

export const propostaInternaSchema = new Schema<IPropostaInterna>(
  {
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'Empresa é obrigatória'],
      index: true,
    },
    clienteId: {
      type: Schema.Types.ObjectId,
      ref: 'Cliente',
      required: [true, 'Cliente é obrigatório'],
      index: true,
    },
    pi_code: {
      type: String,
      required: [true, 'Código PI é obrigatório'],
      unique: true,
      index: true,
    },
    // Unified period fields
    ...createPeriodSchema(),
    // Legacy fields for compatibility
    tipoPeriodo: {
      type: String,
      required: false,
      enum: ['quinzenal', 'mensal'],
    },
    dataInicio: {
      type: Date,
      required: false,
    },
    dataFim: {
      type: Date,
      required: false,
    },
    valorTotal: {
      type: Number,
      required: [true, 'Valor total é obrigatório'],
      min: [0, 'Valor total deve ser maior ou igual a zero'],
    },
    valorProducao: {
      type: Number,
      default: 0,
      min: [0, 'Valor de produção deve ser maior ou igual a zero'],
    },
    descricao: {
      type: String,
      required: [true, 'Descrição é obrigatória'],
      trim: true,
      maxlength: [1000, 'Descrição deve ter no máximo 1000 caracteres'],
    },
    descricaoPeriodo: {
      type: String,
      trim: true,
    },
    produto: {
      type: String,
      trim: true,
      default: 'OUTDOOR',
    },
    placas: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Placa',
      },
    ],
    formaPagamento: {
      type: String,
      trim: true,
    },
    nomeCampanha: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        // V4.1 canonical statuses
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'CONTRACT_GENERATED',
        'CANCELLED',
        // Legacy statuses — kept for backward compatibility
        'em_andamento',
        'concluida',
        'vencida',
      ],
      default: 'DRAFT',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for unified period system
propostaInternaSchema.index({ periodType: 1, empresaId: 1 });
propostaInternaSchema.index({ startDate: 1, endDate: 1 });

// Legacy indexes
propostaInternaSchema.index({ dataInicio: 1, dataFim: 1 });

// Virtual id
propostaInternaSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});

// Virtual para compatibilidade: cliente → clienteId
propostaInternaSchema.virtual('cliente', {
  ref: 'Cliente',
  localField: 'clienteId',
  foreignField: '_id',
  justOne: true
});

// Virtual para compatibilidade: empresa → empresaId
propostaInternaSchema.virtual('empresa', {
  ref: 'Empresa',
  localField: 'empresaId',
  foreignField: '_id',
  justOne: true
});
