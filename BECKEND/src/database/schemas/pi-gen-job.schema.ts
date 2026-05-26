import { Schema } from 'mongoose';
import { IPiGenJob } from '../../types/models';

export const piGenJobSchema = new Schema<IPiGenJob>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    contratoId: {
      type: Schema.Types.ObjectId,
      ref: 'Contrato',
      required: false,
      index: true,
    },
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'done', 'failed'],
      default: 'queued',
      index: true,
    },
    resultPath: {
      type: String,
    },
    resultUrl: {
      type: String,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Índices compostos
piGenJobSchema.index({ empresaId: 1, status: 1 });
piGenJobSchema.index({ contratoId: 1, createdAt: -1 });
piGenJobSchema.index({ piId: 1, createdAt: -1 });

// Virtual id
piGenJobSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});
