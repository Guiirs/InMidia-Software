import { Schema } from 'mongoose';
import { IContrato } from '../../types/models';

export const contratoSchema = new Schema<IContrato>(
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
    piId: {
      type: Schema.Types.ObjectId,
      ref: 'PropostaInterna',
      required: [true, 'Proposta Interna é obrigatória'],
      index: true,
      unique: true,
    },
    numero: {
      type: String,
      required: [true, 'Número do contrato é obrigatório'],
      trim: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['rascunho', 'ativo', 'concluido', 'cancelado'],
      default: 'rascunho',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(_doc: any, ret: any) {
        // Duplica campos populados para compatibilidade com frontend
        if (ret.clienteId && typeof ret.clienteId === 'object') {
          ret.cliente = ret.clienteId;
        }
        if (ret.empresaId && typeof ret.empresaId === 'object') {
          ret.empresa = ret.empresaId;
        }
        if (ret.piId && typeof ret.piId === 'object') {
          ret.pi = ret.piId;
        }
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform: function(_doc: any, ret: any) {
        if (ret.clienteId && typeof ret.clienteId === 'object') {
          ret.cliente = ret.clienteId;
        }
        if (ret.empresaId && typeof ret.empresaId === 'object') {
          ret.empresa = ret.empresaId;
        }
        if (ret.piId && typeof ret.piId === 'object') {
          ret.pi = ret.piId;
        }
        return ret;
      }
    },
  }
);

// Virtual id
contratoSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
