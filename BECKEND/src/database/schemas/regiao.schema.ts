import { Schema } from 'mongoose';
import { IRegiao } from '../../types/models';

export const regiaoSchema = new Schema<IRegiao>(
  {
    nome: {
      type: String,
      required: [true, 'O nome da região é obrigatório'],
      trim: true,
      maxlength: [100, 'Nome deve ter no máximo 100 caracteres'],
    },
    codigo: {
      type: String,
      required: [true, 'O código da região é obrigatório'],
      trim: true,
      uppercase: true,
    },
    descricao: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 2,
    },
    centerLatitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    centerLongitude: {
      type: Number,
      min: -180,
      max: 180,
    },
    color: {
      type: String,
      trim: true,
    },
    ownerName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    polygon: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    operationalPriority: {
      type: Number,
      min: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    ativo: {
      type: Boolean,
      default: true,
      index: true,
    },
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'Região deve pertencer a uma empresa'],
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
regiaoSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});

// Compound unique index: nome must be unique per empresa
regiaoSchema.index({ empresaId: 1, nome: 1 }, { unique: true });

// Virtual para compatibilidade com código legado
regiaoSchema.virtual('empresa').get(function(this: any) {
  return this.empresaId;
});

regiaoSchema.pre('validate', function normalizeFormalRegionFields(next) {
  const doc = this as any;
  doc.name = doc.name || doc.nome;
  doc.nome = doc.nome || doc.name;
  doc.code = (doc.code || doc.codigo || doc.name || doc.nome || '').toString().trim().toUpperCase().replace(/\s+/g, '-');
  doc.codigo = doc.codigo || doc.code;
  doc.description = doc.description || doc.descricao;
  doc.descricao = doc.descricao || doc.description;
  doc.status = doc.status || (doc.ativo === false ? 'INACTIVE' : 'ACTIVE');
  doc.ativo = doc.status !== 'ARCHIVED' && doc.status !== 'INACTIVE';
  next();
});

regiaoSchema.index({ empresaId: 1, code: 1 }, { unique: true, sparse: true });
