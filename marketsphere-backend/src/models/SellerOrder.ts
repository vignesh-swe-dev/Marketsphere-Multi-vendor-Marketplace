import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';
import type { OrderStatus } from '../types/index.ts';

export interface ISellerOrder {
  _id: string;
  id: string;
  parentOrderId: string;
  sellerId: string;
  shopId: string;
  shopName: string;
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
  commissionTotalPaise: number;
  sellerNetPayablePaise: number;
  status: OrderStatus;
  shippingCarrier?: string;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SellerOrderSchema = new Schema<ISellerOrder>(
  {
    _id: { type: String, default: () => `subord_${crypto.randomUUID()}` },
    parentOrderId: { type: String, required: true, index: true },
    sellerId: { type: String, required: true, index: true },
    shopId: { type: String, required: true, index: true },
    shopName: { type: String, required: true },
    subtotalPaise: { type: Number, required: true, min: 0 },
    shippingPaise: { type: Number, required: true, min: 0 },
    taxPaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    commissionTotalPaise: { type: Number, default: 0, min: 0 },
    sellerNetPayablePaise: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'PAID',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        'REFUND_REQUESTED',
        'REFUNDED',
        'PARTIALLY_REFUNDED',
        'DISPUTED',
      ],
      default: 'PENDING_PAYMENT',
      index: true,
    },
    shippingCarrier: { type: String },
    trackingNumber: { type: String },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
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

SellerOrderSchema.virtual('id').get(function () {
  return this._id;
});

SellerOrderSchema.index({ sellerId: 1, createdAt: -1 });
SellerOrderSchema.index({ parentOrderId: 1, sellerId: 1 });

export const SellerOrderModel: Model<ISellerOrder> =
  mongoose.models.SellerOrder ||
  mongoose.model<ISellerOrder>('SellerOrder', SellerOrderSchema);
