import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';
import type { LedgerEntryType } from '../types/index.ts';

export interface ILedgerEntry {
  _id: string;
  id: string;
  transactionId: string;
  sellerId?: string;
  orderId?: string;
  type: LedgerEntryType;
  debitPaise: number;
  creditPaise: number;
  description: string;
  createdAt: Date;
}

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    _id: { type: String, default: () => `led_${crypto.randomUUID()}` },
    transactionId: { type: String, required: true, index: true },
    sellerId: { type: String, index: true },
    orderId: { type: String, index: true },
    type: {
      type: String,
      enum: [
        'GROSS_SALE',
        'MARKETPLACE_COMMISSION',
        'SELLER_PAYABLE',
        'TAX_COLLECTED',
        'SHIPPING_COLLECTED',
        'REFUND_MERCHANDISE',
        'REFUND_COMMISSION_REVERSAL',
        'SELLER_PAYOUT',
      ],
      required: true,
      index: true,
    },
    debitPaise: { type: Number, default: 0, min: 0 },
    creditPaise: { type: Number, default: 0, min: 0 },
    description: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  {
    timestamps: false,
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

LedgerEntrySchema.virtual('id').get(function () {
  return this._id;
});

// Compound indexes for fast ledger queries
LedgerEntrySchema.index({ sellerId: 1, createdAt: -1 });
LedgerEntrySchema.index({ orderId: 1, createdAt: -1 });

export const LedgerEntryModel: Model<ILedgerEntry> =
  mongoose.models.LedgerEntry ||
  mongoose.model<ILedgerEntry>('LedgerEntry', LedgerEntrySchema);
