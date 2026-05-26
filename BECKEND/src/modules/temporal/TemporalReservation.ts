import mongoose, { Model, Schema, Types } from 'mongoose';
import type { TemporalReservationStatus, TemporalSourceType } from './temporal.types';

export interface ITemporalReservation {
  _id: Types.ObjectId;
  empresaId: Types.ObjectId;
  plateId: Types.ObjectId;
  sourceType: TemporalSourceType;
  sourceId: string;
  customerId?: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  status: TemporalReservationStatus;
  reason?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const temporalReservationSchema = new Schema<ITemporalReservation>(
  {
    empresaId: { type: Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    plateId: { type: Schema.Types.ObjectId, ref: 'Placa', required: true, index: true },
    sourceType: {
      type: String,
      enum: ['PI', 'CONTRACT', 'OPERATION', 'MANUAL_BLOCK', 'LEGACY_RENTAL'],
      required: true,
      index: true,
    },
    sourceId: { type: String, required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Cliente', required: false, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['RESERVED', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'BLOCKED'],
      required: true,
      default: 'RESERVED',
      index: true,
    },
    reason: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true, collection: 'temporal_reservations' },
);

temporalReservationSchema.index({ empresaId: 1, plateId: 1, startDate: 1, endDate: 1 });
temporalReservationSchema.index({ empresaId: 1, sourceType: 1, sourceId: 1 });
temporalReservationSchema.index({ empresaId: 1, status: 1, endDate: 1 });

const TemporalReservation: Model<ITemporalReservation> =
  (mongoose.models.TemporalReservation as Model<ITemporalReservation> | undefined)
  || mongoose.model<ITemporalReservation>('TemporalReservation', temporalReservationSchema);

export default TemporalReservation;
