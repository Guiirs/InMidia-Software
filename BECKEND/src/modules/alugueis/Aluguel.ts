import mongoose, { Model } from 'mongoose';
import { IAluguel } from '../../types/models.d';
import { aluguelSchema } from '@database/schemas/aluguel.schema';

const Aluguel: Model<IAluguel> = mongoose.models.Aluguel || mongoose.model<IAluguel>('Aluguel', aluguelSchema);

export default Aluguel;
