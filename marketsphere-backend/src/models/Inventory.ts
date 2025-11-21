import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface IInventory {
  _id: string;
  id: string;
  stockItemId: string; // SKU or variantId
  productId?: string;
  sellerId?: string;
  totalQuantity: number;
  reservedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryReservation {
  _id: string;
  id: string;
  reservationId: string;
  orderOrCheckoutId: string;
  stockItemId: string;
  quantity: number;
  status: 'ACTIVE' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  expiresAt: Date;
  createdAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    _id: { type: String, default: () => `inv_${crypto.randomUUID()}` },
    stockItemId: { type: String, required: true, unique: true, index: true },
    productId: { type: String, index: true },
    sellerId: { type: String, index: true },
    totalQuantity: { type: Number, required: true, min: 0, default: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
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

InventorySchema.virtual('id').get(function () {
  return this._id;
});

const InventoryReservationSchema = new Schema<IInventoryReservation>(
  {
    _id: { type: String, default: () => `res_${crypto.randomUUID()}` },
    reservationId: { type: String, required: true, index: true },
    orderOrCheckoutId: { type: String, required: true, index: true },
    stockItemId: { type: String, required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: documents automatically expire when expiresAt has passed
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

InventoryReservationSchema.virtual('id').get(function () {
  return this._id;
});

export const InventoryModel: Model<IInventory> =
  mongoose.models.Inventory || mongoose.model<IInventory>('Inventory', InventorySchema);

export const InventoryReservationModel: Model<IInventoryReservation> =
  mongoose.models.InventoryReservation ||
  mongoose.model<IInventoryReservation>('InventoryReservation', InventoryReservationSchema);
