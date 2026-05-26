import { Schema } from 'mongoose';
import { IBiWeek } from '../../types/models';

export const biWeekSchema = new Schema<IBiWeek>(
  {
    bi_week_id: {
      type: String,
      required: [true, 'O ID da Bi-Semana é obrigatório'],
      unique: true,
      index: true,
      trim: true,
      match: [
        /^\d{4}-\d{2}$/,
        'Formato de bi_week_id inválido. Use YYYY-NN (ex: 2026-02)',
      ],
    },
    ano: {
      type: Number,
      required: [true, 'O ano é obrigatório'],
      index: true,
      min: [2020, 'O ano deve ser 2020 ou posterior'],
      max: [2100, 'Ano inválido'],
    },
    numero: {
      type: Number,
      required: [true, 'O número da Bi-Semana é obrigatório'],
      min: [2, 'O número da Bi-Semana deve ser entre 2 e 52'],
      max: [52, 'O número da Bi-Semana deve ser entre 2 e 52'],
      validate: {
        validator: function (v: number) {
          return v % 2 === 0;
        },
        message: 'O número da bi-semana deve ser par (02, 04, 06... 52)',
      },
    },
    dataInicio: {
      type: Date,
      required: [true, 'A data de início é obrigatória'],
      index: true,
    },
    dataFim: {
      type: Date,
      required: [true, 'A data de término é obrigatória'],
      index: true,
    },
    descricao: {
      type: String,
      trim: true,
      maxlength: [200, 'A descrição não pode ter mais de 200 caracteres'],
    },
    ativo: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
biWeekSchema.index({ ano: 1, numero: 1 }, { unique: true });
biWeekSchema.index({ dataInicio: 1, dataFim: 1 });

// Virtual id
biWeekSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Pre-save validation
biWeekSchema.pre('save', function (next) {
  if (this.dataFim <= this.dataInicio) {
    return next(new Error('A data de término deve ser posterior à data de início'));
  }

  const diffMs = this.dataFim.getTime() - this.dataInicio.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays < 12 || diffDays > 16) {
    return next(
      new Error(`Uma Bi-Semana deve ter aproximadamente 14 dias. Período atual: ${diffDays} dias`)
    );
  }

  next();
});
