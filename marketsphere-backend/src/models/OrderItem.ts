import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface IOrderItem {
  _id: string;
  id: string;
  sellerOrderId: string;
  orderId?: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  variantName?: string;
  unitPricePaise: number;
  quantity: number;
  totalPaise: number;
  allocatedDiscountPaise: number;
  taxPaise: number;
  commissionRate: number;
  commissionAmountPaise: number;
  sellerPayablePaise: number;
  imageUrl?: string;
  createdAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    _id: { type: String, default: () => `item_${crypto.randomUUID()}` },
    sellerOrderId: { type: String, required: true, index: true },
    orderId: { type: String, index: true },
    productId: { type: String, required: true, index: true },
    variantId: { type: String, index: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    variantName: { type: String },
    unitPricePaise: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    totalPaise: { type: Number, required: true, min: 0 },
    allocatedDiscountPaise: { type: Number, default: 0, min: 0 },
    taxPaise: { type: Number, default: 0, min: 0 },
    commissionRate: { type: Number, required: true, min: 0 },
    commissionAmountPaise: { type: Number, required: true, min: 0 },
    sellerPayablePaise: { type: Number, required: true },
    imageUrl: { type: String },
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

OrderItemSchema.virtual('id').get(function () {
  return this._id;
});

export const OrderItemModel: Model<IOrderItem> =
  mongoose.models.OrderItem || mongoose.model<IOrderItem>('OrderItem', OrderItemSchema);
