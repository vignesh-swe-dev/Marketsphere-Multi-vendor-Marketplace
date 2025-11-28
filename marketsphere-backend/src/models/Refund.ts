import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface IRefund {
  _id: string;
  id: string;
  orderId: string;
  sellerOrderId?: string;
  amountPaise: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSED' | 'REJECTED';
  actorId?: string;
  actorRole?: string;
  providerRefundId?: string;
  createdAt: Date;
}

const RefundSchema = new Schema<IRefund>(
  {
    _id: { type: String, default: () => `ref_${crypto.randomUUID()}` },
    orderId: { type: String, required: true, index: true },
    sellerOrderId: { type: String, index: true },
    amountPaise: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'PROCESSED', 'REJECTED'],
      default: 'PROCESSED',
      index: true,
    },
    actorId: { type: String },
    actorRole: { type: String },
    providerRefundId: { type: String },
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

RefundSchema.virtual('id').get(function () {
  return this._id;
});

export const RefundModel: Model<IRefund> =
  mongoose.models.Refund || mongoose.model<IRefund>('Refund', RefundSchema);
