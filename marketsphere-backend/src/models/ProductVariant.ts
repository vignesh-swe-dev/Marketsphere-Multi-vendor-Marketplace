import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface IProductVariant {
  _id: string;
  id: string;
  productId: string;
  name: string;
  sku: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  inventoryQuantity: number;
  attributes: Map<string, string> | Record<string, string>;
  createdAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    _id: { type: String, default: () => `var_${crypto.randomUUID()}` },
    productId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, index: true },
    pricePaise: { type: Number, required: true, min: 0 },
    compareAtPricePaise: { type: Number },
    inventoryQuantity: { type: Number, default: 0, min: 0 },
    attributes: { type: Schema.Types.Mixed, default: {} },
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

ProductVariantSchema.virtual('id').get(function () {
  return this._id;
});

export const ProductVariantModel: Model<IProductVariant> =
  mongoose.models.ProductVariant ||
  mongoose.model<IProductVariant>('ProductVariant', ProductVariantSchema);
