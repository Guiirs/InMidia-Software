import mongoose, { Schema, Document } from 'mongoose';

export interface IChecking extends Document {
  empresaId: mongoose.Types.ObjectId; // ref: Empresa
  aluguelId: mongoose.Types.ObjectId; // ref: Aluguel
  placaId: mongoose.Types.ObjectId; // ref: Placa
  installerId: mongoose.Types.ObjectId; // ref: User
  photoUrl: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  } | string; // Can be object or string
  installedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const CheckingSchema: Schema = new Schema({
  empresaId: { type: Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  aluguelId: { type: Schema.Types.ObjectId, ref: 'Aluguel', required: true },
  placaId: { type: Schema.Types.ObjectId, ref: 'Placa', required: true },
  installerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  photoUrl: { type: String, required: true },
  gpsCoordinates: { type: Schema.Types.Mixed, required: true }, // Can store object or string
  installedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

CheckingSchema.index({ empresaId: 1, aluguelId: 1 });
CheckingSchema.index({ empresaId: 1, createdAt: -1 });

export default mongoose.model<IChecking>('Checking', CheckingSchema);
