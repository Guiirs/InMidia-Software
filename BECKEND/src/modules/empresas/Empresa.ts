import mongoose, { Model } from 'mongoose';
import { IEmpresa } from '../../types/models.d';
import { empresaSchema } from '@database/schemas/empresa.schema';
import crypto from 'crypto';

export { IApiKeyHistory } from '@database/schemas/empresa.schema';

// Method to regenerate API key
empresaSchema.methods.generateApiKey = function (): string {
  this.apiKey = crypto.randomBytes(20).toString('hex');
  return this.apiKey;
};

const Empresa: Model<IEmpresa> = mongoose.models.Empresa || mongoose.model<IEmpresa>('Empresa', empresaSchema);

export default Empresa;
