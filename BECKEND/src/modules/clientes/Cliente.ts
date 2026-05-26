import mongoose, { Model } from 'mongoose';
import { ICliente } from '../../types/models.d';
import { clienteSchema } from '@database/schemas/cliente.schema';

const Cliente: Model<ICliente> = mongoose.models.Cliente || mongoose.model<ICliente>('Cliente', clienteSchema);

export default Cliente;
