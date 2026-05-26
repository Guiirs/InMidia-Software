import { Schema } from 'mongoose';

export interface IRefreshToken {
  _id: Schema.Types.ObjectId;
  tokenHash: string;     // SHA-256 hash — nunca o token bruto
  userId: Schema.Types.ObjectId;
  empresaId: Schema.Types.ObjectId;
  ip: string;
  userAgent: string;
  family: string;        // UUID da família de tokens — detecta replay/reuse
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    empresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: true,
      index: true,
    },
    ip: { type: String, required: true },
    userAgent: { type: String, required: true },
    family: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL auto-remove após expiração
    },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });
