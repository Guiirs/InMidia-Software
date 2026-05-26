import mongoose from 'mongoose';
import { refreshTokenSchema, type IRefreshToken } from '@database/schemas/refresh-token.schema';

const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);

export default RefreshToken;
