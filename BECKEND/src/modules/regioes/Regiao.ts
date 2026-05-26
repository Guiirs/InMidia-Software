import mongoose, { Model } from 'mongoose';
import { IRegiao } from '../../types/models.d';
import { regiaoSchema } from '@database/schemas/regiao.schema';

const Regiao: Model<IRegiao> = mongoose.models.Regiao || mongoose.model<IRegiao>('Regiao', regiaoSchema);

export default Regiao;
