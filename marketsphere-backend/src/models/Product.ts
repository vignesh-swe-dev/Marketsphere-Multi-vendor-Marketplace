import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';
import type { ProductStatus } from '../types/index.ts';

export interface IProduct {
  _id: string;
  id: string;
  shopId: string;
  sellerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  images: string[];
  basePricePaise: number;
  sku: string;
  brand: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  inventoryTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    _id: { type: String, default: () => `prod_${crypto.randomUUID()}` },
    shopId: { type: String, required: true, index: true },
    sellerId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    images: [{ type: String }],
    basePricePaise: { type: Number, required: true, min: 0 },
    sku: { type: String, required: true, trim: true, index: true },
    brand: { type: String, default: '', trim: true },
    tags: [{ type: String, trim: true }],
    rating: { type: Number, default: 5.0 },
    reviewCount: { type: Number, default: 0 },
    inventoryTotal: { type: Number, default: 0 },
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

ProductSchema.virtual('id').get(function () {
  return this._id;
});

// Full text index on name, description, brand, and tags for product search
ProductSchema.index({ name: 'text', description: 'text', brand: 'text', tags: 'text' });
// Compound index for queries by seller and status, category and status
ProductSchema.index({ sellerId: 1, status: 1 });
ProductSchema.index({ categoryId: 1, status: 1 });
ProductSchema.index({ createdAt: -1 });

export const ProductModel: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
