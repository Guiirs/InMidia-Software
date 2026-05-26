import mongoose, { Model } from 'mongoose';
import { IPlaca } from '../../types/models.d';
import { placaSchema } from '@database/schemas/placa.schema';

const Placa: Model<IPlaca> = mongoose.models.Placa || mongoose.model<IPlaca>('Placa', placaSchema);

export default Placa;
