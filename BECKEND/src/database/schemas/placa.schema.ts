import { Schema, Types } from 'mongoose';
import { IPlaca } from '../../types/models';

export const PlateImageCategoryValues = [
  'MAIN',
  'INSTALLATION',
  'SCRAPING',
  'MAINTENANCE',
  'BEFORE',
  'AFTER',
  'OTHER',
] as const;

export type PlateImageCategory = (typeof PlateImageCategoryValues)[number];

const plateImageSchema = new Schema(
  {
    id: { type: String, trim: true },
    url: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    filename: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number },
    category: { type: String, enum: PlateImageCategoryValues, default: 'OTHER' },
    isMain: { type: Boolean, default: false },
    source: { type: String, enum: ['UPLOAD', 'GENERATED', 'IMPORTED'], default: 'UPLOAD' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    generatedBy: { type: String, trim: true },
    templateId: { type: String, trim: true },
    generationSource: { type: String, trim: true },
    overlayData: { type: Schema.Types.Mixed },
    version: { type: Number, default: 1 },
  },
  { _id: true },
);

export const placaSchema = new Schema<IPlaca>(
  {
    // ── Número e identificação ──────────────────────────────────────────────
    numero_placa: {
      type: String,
      required: [true, 'Número da placa é obrigatório'],
      trim: true,
      index: true,
    },
    numeroOperacional: { type: Number, min: 1, index: true },

    // ── Endereço e localização ──────────────────────────────────────────────
    /** Campo canônico de endereço (antigo nomeDaRua). */
    endereco: { type: String, trim: true },
    /** @deprecated Use endereco. Mantido para compatibilidade. */
    nomeDaRua: { type: String, trim: true },
    /** @deprecated Use endereco. */
    localizacao: { type: String, trim: true },

    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    /** @deprecated Use latitude/longitude. Formato legado "lat,lng". */
    coordenadas: { type: String, trim: true },

    // ── Imagens ────────────────────────────────────────────────────────────
    /** URL canônica da imagem principal (aponta para R2). */
    imagemPrincipal: { type: String, trim: true },
    /** @deprecated Use imagemPrincipal. */
    imagem: { type: String, trim: true },
    /** Galeria de imagens com metadata completo. */
    imagens: { type: [plateImageSchema], default: [] },

    // ── Dimensões / tipo ──────────────────────────────────────────────────
    tamanho: { type: String, trim: true },
    tipo: { type: String, trim: true },
    largura: { type: Number },
    altura: { type: Number },
    /** @deprecated Comercial legacy. Nao gerenciar pela placa; derivar de PI/Contrato. */
    valor_mensal: { type: Number, default: 0 },

    // ── Status ─────────────────────────────────────────────────────────────
    /** Campo canônico de disponibilidade física. */
    disponivel: { type: Boolean, default: true, index: true },
    statusOperacional: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    statusComercial: {
      type: String,
      enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'UNAVAILABLE'],
      default: 'AVAILABLE',
      index: true,
    },

    // ── Observações ────────────────────────────────────────────────────────
    notes: { type: String, trim: true, maxlength: 2000 },
    /** @deprecated Use notes. */
    observacoes: { type: String, trim: true },

    // ── Região ────────────────────────────────────────────────────────────
    /** Campo canônico de região (novo padrão). */
    regiaoId: {
      type: Schema.Types.ObjectId,
      ref: 'Regiao',
      required: [true, 'Região é obrigatória'],
      index: true,
    },
    /** @deprecated Alias; sincronizado via pre-validate. */
    regionId: { type: Schema.Types.ObjectId, ref: 'Regiao', index: true },
    /** Lote regional canônico. */
    regionalLot: { type: String, trim: true },
    /** @deprecated Alias. */
    loteRegional: { type: String, trim: true },

    // ── Empresa ───────────────────────────────────────────────────────────
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'Empresa é obrigatória'],
      index: true,
    },

    // ── Auditoria de escrita ───────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // ── Soft delete ───────────────────────────────────────────────────────
    archivedAt: { type: Date },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc: any, ret: any) {
        if (ret.regiaoId && typeof ret.regiaoId === 'object') {
          ret.regiao = ret.regiaoId;
        }
        // Endereço canônico retrocompatível
        ret.nomeDaRua = ret.nomeDaRua || ret.endereco;
        ret.endereco = ret.endereco || ret.nomeDaRua;
        // Imagem canônica retrocompatível
        ret.imagem = ret.imagem || ret.imagemPrincipal;
        ret.imagemPrincipal = ret.imagemPrincipal || ret.imagem;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc: any, ret: any) {
        if (ret.regiaoId && typeof ret.regiaoId === 'object') {
          ret.regiao = ret.regiaoId;
        }
        ret.nomeDaRua = ret.nomeDaRua || ret.endereco;
        ret.endereco = ret.endereco || ret.nomeDaRua;
        ret.imagem = ret.imagem || ret.imagemPrincipal;
        ret.imagemPrincipal = ret.imagemPrincipal || ret.imagem;
        return ret;
      },
    },
  },
);

// ── Virtuals ────────────────────────────────────────────────────────────────
placaSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});

placaSchema.virtual('statusAluguel');

placaSchema.virtual('empresa').get(function (this: any) {
  return this.empresaId;
});

placaSchema.virtual('regiao', {
  ref: 'Regiao',
  localField: 'regiaoId',
  foreignField: '_id',
  justOne: true,
});

// ── Índices compostos ───────────────────────────────────────────────────────
placaSchema.index({ empresaId: 1, disponivel: 1 });
placaSchema.index({ empresaId: 1, regiaoId: 1 });
placaSchema.index({ empresaId: 1, regionId: 1 });
placaSchema.index({ empresaId: 1, statusOperacional: 1 });
placaSchema.index({ empresaId: 1, statusComercial: 1 });
placaSchema.index(
  { empresaId: 1, numeroOperacional: 1 },
  { unique: true, partialFilterExpression: { numeroOperacional: { $type: 'number' } } },
);
// Unicidade de numero_placa por empresa
placaSchema.index(
  { empresaId: 1, numero_placa: 1 },
  { unique: true, name: 'idx_placa_numero_empresa_unique' },
);

// ── Pre-validate: sincroniza aliases ────────────────────────────────────────
placaSchema.pre('validate', function normalizePlacaAliases(next) {
  const doc = this as any;

  // Região
  doc.regionId = doc.regionId || doc.regiaoId;
  doc.regiaoId = doc.regiaoId || doc.regionId;

  // Lote regional
  doc.regionalLot = doc.regionalLot || doc.loteRegional;
  doc.loteRegional = doc.loteRegional || doc.regionalLot;

  // Endereço
  doc.endereco = doc.endereco || doc.nomeDaRua || doc.localizacao;
  doc.nomeDaRua = doc.nomeDaRua || doc.endereco;

  // Imagem principal
  doc.imagemPrincipal = doc.imagemPrincipal || doc.imagem;
  doc.imagem = doc.imagem || doc.imagemPrincipal;

  // StatusOperacional: se archivedAt definido, garantir ARCHIVED
  if (doc.archivedAt && doc.statusOperacional !== 'ARCHIVED') {
    doc.statusOperacional = 'ARCHIVED';
  }

  next();
});

// Exporta o tipo da imagem embutida para uso nos services
export type PlateImageDoc = {
  _id: Types.ObjectId;
  url: string;
  key: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  category: PlateImageCategory;
  uploadedBy?: Types.ObjectId;
  uploadedAt: Date;
};
