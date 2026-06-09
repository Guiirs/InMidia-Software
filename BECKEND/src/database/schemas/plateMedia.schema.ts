import { Schema } from 'mongoose';

// ─── Constants ─────────────────────────────────────────────────────────────────

export const PlateMediaStatuses = ['active', 'missing', 'processing', 'error'] as const;
export const PlateMediaSources  = ['upload', 'migration', 'repair', 'legacy'] as const;

export type PlateMediaStatus = (typeof PlateMediaStatuses)[number];
export type PlateMediaSource = (typeof PlateMediaSources)[number];

// ─── Sub-document: history entry ───────────────────────────────────────────────

export interface IPlateMediaHistoryEntry {
  key: string;
  mimeType: string | null;
  size: number | null;
  uploadedAt: Date;
  isActive: boolean;
  source: PlateMediaSource;
}

// ─── Main document ─────────────────────────────────────────────────────────────

/**
 * PlateMedia — fonte canônica da imagem principal de cada placa.
 *
 * Um documento por placa (índice único em plateId).
 * activeKey é a R2 storage key atualmente ativa.
 * version é um string monotônico (timestamp ms) usado para cache-busting de URL.
 * history mantém as últimas 50 imagens para diagnóstico e rollback.
 *
 * Campos WebP (otimização segura):
 *   optimizedKey — R2 key do WebP gerado (original nunca é sobrescrito)
 *   webpEnabled  — se true, o endpoint público serve optimizedKey em vez de activeKey
 *   optimizedAt  — quando a conversão foi concluída
 *   optimizedSize — tamanho do WebP em bytes
 */
export interface IPlateMedia {
  plateId:       Schema.Types.ObjectId;
  empresaId:     Schema.Types.ObjectId;
  activeKey:     string | null;
  status:        PlateMediaStatus;
  version:       string;
  mimeType:      string | null;
  size:          number | null;
  width:         number | null;
  height:        number | null;
  history:       IPlateMediaHistoryEntry[];
  optimizedKey:  string | null;
  webpEnabled:   boolean;
  optimizedAt:   Date | null;
  optimizedSize: number | null;
}

// ─── Schemas ───────────────────────────────────────────────────────────────────

const plateMediaHistorySchema = new Schema<IPlateMediaHistoryEntry>(
  {
    key:        { type: String, required: true, trim: true },
    mimeType:   { type: String, default: null },
    size:       { type: Number, default: null },
    uploadedAt: { type: Date, default: Date.now },
    isActive:   { type: Boolean, default: false },
    source:     { type: String, enum: PlateMediaSources, default: 'upload' },
  },
  { _id: false },
);

export const plateMediaSchema = new Schema<IPlateMedia>(
  {
    plateId:   { type: Schema.Types.ObjectId, ref: 'Placa',  required: true },
    empresaId: { type: Schema.Types.ObjectId, ref: 'Empresa', required: true },
    activeKey:     { type: String, default: null, trim: true },
    status:        { type: String, enum: PlateMediaStatuses, default: 'missing' },
    version:       { type: String, default: '' },
    mimeType:      { type: String, default: null },
    size:          { type: Number, default: null },
    width:         { type: Number, default: null },
    height:        { type: Number, default: null },
    history:       { type: [plateMediaHistorySchema], default: [] },
    optimizedKey:  { type: String, default: null, trim: true },
    webpEnabled:   { type: Boolean, default: false },
    optimizedAt:   { type: Date, default: null },
    optimizedSize: { type: Number, default: null },
  },
  { timestamps: true },
);

// Uma placa tem exatamente um documento PlateMedia.
plateMediaSchema.index({ plateId: 1 }, { unique: true });
// Lookup por empresa (usado no script de migração e limpeza).
plateMediaSchema.index({ empresaId: 1, plateId: 1 });
// Localização por key ativa (diagnóstico, deduplicação).
plateMediaSchema.index({ activeKey: 1 }, { sparse: true });
// Ordenação cronológica para relatórios.
plateMediaSchema.index({ updatedAt: -1 });
