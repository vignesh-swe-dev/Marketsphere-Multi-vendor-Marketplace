import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface IShop {
  _id: string;
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  shippingPolicy?: string;
  refundPolicy?: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShopSchema = new Schema<IShop>(
  {
    _id: { type: String, default: () => `shop_${crypto.randomUUID()}` },
    sellerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    tagline: { type: String },
    description: { type: String },
    logoUrl: { type: String },
    bannerUrl: { type: String },
    shippingPolicy: { type: String },
    refundPolicy: { type: String },
    rating: { type: Number, default: 5.0 },
    reviewCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
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

ShopSchema.virtual('id').get(function () {
  return this._id;
});

export const ShopModel: Model<IShop> =
  mongoose.models.Shop || mongoose.model<IShop>('Shop', ShopSchema);
