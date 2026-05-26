import mongoose, { Model } from 'mongoose';
import { IContrato } from '../../types/models.d';
import { contratoSchema } from '@database/schemas/contrato.schema';

const Contrato: Model<IContrato> = mongoose.models.Contrato || mongoose.model<IContrato>('Contrato', contratoSchema);

export default Contrato;
