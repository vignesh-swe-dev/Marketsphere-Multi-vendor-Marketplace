import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';
import type { OrderStatus } from '../types/index.ts';

export interface IOrderAddress {
  id?: string;
  fullName: string;
  phone?: string;
  streetAddress: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface IOrder {
  _id: string;
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  discountPaise: number;
  totalPaise: number;
  currency: string;
  shippingAddress: IOrderAddress;
  paymentMethod: string;
  paymentId?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  invoiceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    _id: { type: String, default: () => `ord_${crypto.randomUUID()}` },
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },
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
    subtotalPaise: { type: Number, required: true, min: 0 },
    shippingPaise: { type: Number, required: true, min: 0 },
    taxPaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String },
      streetAddress: { type: String, required: true },
      landmark: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, default: 'India' },
    },
    paymentMethod: { type: String, default: 'SANDBOX' },
    paymentId: { type: String },
    trackingNumber: { type: String },
    shippingCarrier: { type: String },
    invoiceUrl: { type: String },
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

OrderSchema.virtual('id').get(function () {
  return this._id;
});

OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

export const OrderModel: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
