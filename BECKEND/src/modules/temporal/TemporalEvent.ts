import mongoose, { Model, Schema, Types } from 'mongoose';
import type { TemporalEventType } from './temporal.types';

export interface ITemporalEvent {
  _id: Types.ObjectId;
  empresaId: Types.ObjectId;
  plateId?: Types.ObjectId;
  sourceType?: string;
  sourceId?: string;
  eventType: TemporalEventType;
  message: string;
  metadata: Record<string, unknown>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const temporalEventSchema = new Schema<ITemporalEvent>(
  {
    empresaId: { type: Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    plateId: { type: Schema.Types.ObjectId, ref: 'Placa', required: false, index: true },
    sourceType: { type: String, trim: true },
    sourceId: { type: String, trim: true, index: true },
    eventType: { type: String, required: true, index: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true, collection: 'temporal_events' },
);

temporalEventSchema.index({ empresaId: 1, plateId: 1, createdAt: -1 });
temporalEventSchema.index({ empresaId: 1, eventType: 1, createdAt: -1 });

const TemporalEvent: Model<ITemporalEvent> =
  (mongoose.models.TemporalEvent as Model<ITemporalEvent> | undefined)
  || mongoose.model<ITemporalEvent>('TemporalEvent', temporalEventSchema);

export default TemporalEvent;
