import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface IRefreshToken {
  _id: string;
  tokenHash: string;
  userId: string;
  familyId: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    _id: { type: String, default: () => `tok_${crypto.randomUUID()}` },
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    isRevoked: { type: Boolean, default: false, index: true },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: MongoDB automatically purges expired tokens
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

RefreshTokenSchema.virtual('id').get(function () {
  return this._id;
});

export const RefreshTokenModel: Model<IRefreshToken> =
  mongoose.models.RefreshToken ||
  mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
