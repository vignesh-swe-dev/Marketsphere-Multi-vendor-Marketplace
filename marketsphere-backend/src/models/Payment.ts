import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';
import type { PaymentStatus } from '../types/index.ts';

export interface IPayment {
  _id: string;
  id: string;
  orderId: string;
  provider: 'SANDBOX' | 'RAZORPAY' | 'STRIPE';
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  idempotencyKey: string;
  signatureVerified: boolean;
  rawPayload?: Record<string, unknown>;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    _id: { type: String, default: () => `pay_${crypto.randomUUID()}` },
    orderId: { type: String, required: true, index: true },
    provider: { type: String, enum: ['SANDBOX', 'RAZORPAY', 'STRIPE'], default: 'SANDBOX' },
    providerPaymentId: { type: String, required: true, index: true },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['INITIATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
      default: 'INITIATED',
      index: true,
    },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    signatureVerified: { type: Boolean, default: false },
    rawPayload: { type: Schema.Types.Mixed },
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

PaymentSchema.virtual('id').get(function () {
  return this._id;
});

export const PaymentModel: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
