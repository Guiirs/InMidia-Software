import { Schema } from 'mongoose';
import { IAluguel } from '../../types/models';
import { createPeriodSchema } from '../../utils/periodTypes';

/**
 * Schema do Aluguel
 * 
 * Representa um aluguel (locação) de uma placa para um cliente por um período específico.
 * 
 * SISTEMA DE PERÍODOS:
 * - v2.0+: Usa periodType, startDate, endDate, biWeekIds (sistema unificado)
 * - v1.0: Usa data_inicio, data_fim, bi_week_ids (campos legados - mantidos para compatibilidade)
 * 
 * CAMPOS LEGADOS:
 * - data_inicio, data_fim, bi_week_ids estão marcados como deprecated
 * - Virtuals fornecem acesso bidirecional (novo ↔ legado)
 * - Planejado para remoção na v3.0
 * 
 * @since 2.0.0 - Sistema unificado de períodos
 * @since 1.0.0 - Versão original
 */
export const aluguelSchema = new Schema<IAluguel>(
  {
    placaId: {
      type: Schema.Types.ObjectId,
      ref: 'Placa',
      required: [true, 'A placa é obrigatória'],
      index: true,
    },
    clienteId: {
      type: Schema.Types.ObjectId,
      ref: 'Cliente',
      required: [true, 'O cliente é obrigatório'],
      index: true,
    },
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'A empresa é obrigatória'],
      index: true,
    },
    // Unified period fields (v2.0+)
    ...createPeriodSchema(),
    
    /**
     * @deprecated Use biWeekIds instead. Mantido para compatibilidade.
     * @since 1.0.0
     * @removed 3.0.0 (planejado)
     */
    bi_week_ids: [
      {
        type: String,
        sparse: true,
      },
    ],
    
    /**
     * @deprecated Use startDate instead. Mantido para compatibilidade.
     * @since 1.0.0
     * @removed 3.0.0 (planejado)
     */
    data_inicio: {
      type: Date,
      required: false,
    },
    
    /**
     * @deprecated Use endDate instead. Mantido para compatibilidade.
     * @since 1.0.0
     * @removed 3.0.0 (planejado)
     */
    data_fim: {
      type: Date,
      required: false,
    },
    // PI integration
    pi_code: {
      type: String,
      required: false,
      index: true,
      sparse: true,
    },
    proposta_interna: {
      type: Schema.Types.ObjectId,
      ref: 'PropostaInterna',
      required: false,
      index: true,
      sparse: true,
    },
    tipo: {
      type: String,
      enum: ['manual', 'pi'],
      default: 'manual',
      index: true,
    },
    status: {
      type: String,
      enum: ['ativo', 'finalizado', 'cancelado'],
      default: 'ativo',
      index: true,
    },
    observacoes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(_doc: any, ret: any) {
        // Compatibilidade: Se campos populados, duplicar para nomes alternativos
        if (ret.placaId && typeof ret.placaId === 'object') {
          ret.placa = ret.placaId;
        }
        if (ret.clienteId && typeof ret.clienteId === 'object') {
          ret.cliente = ret.clienteId;
        }
        if (ret.empresaId && typeof ret.empresaId === 'object') {
          ret.empresa = ret.empresaId;
        }
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      transform: function(_doc: any, ret: any) {
        if (ret.placaId && typeof ret.placaId === 'object') {
          ret.placa = ret.placaId;
        }
        if (ret.clienteId && typeof ret.clienteId === 'object') {
          ret.cliente = ret.clienteId;
        }
        if (ret.empresaId && typeof ret.empresaId === 'object') {
          ret.empresa = ret.empresaId;
        }
        return ret;
      }
    },
  }
);

// Indexes for unified period system (v2.0+)
aluguelSchema.index({ placaId: 1, startDate: 1, endDate: 1 });
aluguelSchema.index({ empresaId: 1, endDate: 1 });
aluguelSchema.index({ periodType: 1, empresaId: 1 });
aluguelSchema.index({ biWeekIds: 1, empresaId: 1 });

/**
 * @deprecated Legacy indexes - mantidos para queries antigas
 * @removed 3.0.0 (planejado)
 */
aluguelSchema.index({ placaId: 1, data_inicio: 1, data_fim: 1 });
aluguelSchema.index({ empresaId: 1, data_fim: 1 });
aluguelSchema.index({ bi_week_ids: 1, empresaId: 1 });

// Virtual: id (para compatibilidade com frontend)
aluguelSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});

/**
 * Virtual: dataInicio
 * Fornece acesso compatível ao campo data_inicio (legado) através de startDate (novo)
 * @deprecated Use startDate diretamente
 */
aluguelSchema.virtual('dataInicio').get(function (this: IAluguel) {
  return this.startDate || this.data_inicio;
});

/**
 * Virtual: dataFim
 * Fornece acesso compatível ao campo data_fim (legado) através de endDate (novo)
 * @deprecated Use endDate diretamente
 */
aluguelSchema.virtual('dataFim').get(function (this: IAluguel) {
  return this.endDate || this.data_fim;
});

/**
 * Virtual: biWeekIdsLegacy
 * Fornece acesso compatível ao campo bi_week_ids (legado) através de biWeekIds (novo)
 * @deprecated Use biWeekIds diretamente
 */
aluguelSchema.virtual('biWeekIdsLegacy').get(function (this: IAluguel) {
  return this.biWeekIds || this.bi_week_ids;
});

/**
 * Hook pre-save: Sincroniza campos novos ↔ legados
 * Garante que ambos os sistemas tenham os mesmos dados
 */
aluguelSchema.pre('save', function (next) {
  // Se campos novos existem, sincroniza para legados
  if (this.startDate && !this.data_inicio) {
    this.data_inicio = this.startDate;
  }
  if (this.endDate && !this.data_fim) {
    this.data_fim = this.endDate;
  }
  if (this.biWeekIds && this.biWeekIds.length > 0 && (!this.bi_week_ids || this.bi_week_ids.length === 0)) {
    this.bi_week_ids = this.biWeekIds;
  }

  // Se apenas campos legados existem, sincroniza para novos
  if (!this.startDate && this.data_inicio) {
    this.startDate = this.data_inicio;
  }
  if (!this.endDate && this.data_fim) {
    this.endDate = this.data_fim;
  }
  if ((!this.biWeekIds || this.biWeekIds.length === 0) && this.bi_week_ids && this.bi_week_ids.length > 0) {
    this.biWeekIds = this.bi_week_ids;
  }

  next();
});
