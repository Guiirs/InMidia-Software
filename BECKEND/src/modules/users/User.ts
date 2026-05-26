import mongoose, { Model } from 'mongoose';
import { IUser } from '../../types/models.d';
import { userSchema } from '@database/schemas/user.schema';
import bcrypt from 'bcryptjs';

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.senha);
};

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;
