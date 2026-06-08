import mongoose, { Model } from 'mongoose';
import { IPlateMedia, plateMediaSchema } from '@database/schemas/plateMedia.schema';

const PlateMedia: Model<IPlateMedia> = mongoose.models.PlateMedia
  || mongoose.model<IPlateMedia>('PlateMedia', plateMediaSchema);

export default PlateMedia;
