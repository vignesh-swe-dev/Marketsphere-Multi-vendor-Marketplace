import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface IReview {
  _id: string;
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  sellerReply?: {
    comment: string;
    repliedAt: Date;
  };
  createdAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    _id: { type: String, default: () => `rev_${crypto.randomUUID()}` },
    productId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true },
    comment: { type: String, required: true, trim: true },
    verifiedPurchase: { type: Boolean, default: false },
    sellerReply: {
      comment: { type: String },
      repliedAt: { type: Date },
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

ReviewSchema.virtual('id').get(function () {
  return this._id;
});

ReviewSchema.index({ productId: 1, createdAt: -1 });

export const ReviewModel: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);
