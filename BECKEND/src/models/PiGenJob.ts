import mongoose, { Model } from 'mongoose';
import { IPiGenJob } from '../types/models';
import { piGenJobSchema } from '../database/schemas/pi-gen-job.schema';

const PiGenJob: Model<IPiGenJob> =
  mongoose.models.PiGenJob || mongoose.model<IPiGenJob>('PiGenJob', piGenJobSchema);

export default PiGenJob;
