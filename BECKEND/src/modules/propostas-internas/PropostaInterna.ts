import mongoose, { Model } from 'mongoose';
import { IPropostaInterna } from '../../types/models.d';
import { propostaInternaSchema } from '@database/schemas/proposta-interna.schema';

const PropostaInterna: Model<IPropostaInterna> = mongoose.models.PropostaInterna || mongoose.model<IPropostaInterna>(
  'PropostaInterna',
  propostaInternaSchema
);

export default PropostaInterna;
