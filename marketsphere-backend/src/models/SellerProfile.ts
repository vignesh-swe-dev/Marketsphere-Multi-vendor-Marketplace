import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';
import type { SellerStatus } from '../types/index.ts';

export interface IBankDetails {
  accountHolder: string;
  accountNumberMasked: string;
  routingOrIfsc: string;
  bankName: string;
}

export interface ISellerProfile {
  _id: string;
  id: string;
  userId: string;
  businessName: string;
  businessRegistrationNumber?: string;
  taxId?: string;
  gstin?: string;
  pan?: string;
  ifsc?: string;
  contactEmail: string;
  contactPhone: string;
  status: SellerStatus;
  rejectionReason?: string;
  commissionRateOverride?: number;
  bankDetails?: IBankDetails;
  appliedAt: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SellerProfileSchema = new Schema<ISellerProfile>(
  {
    _id: { type: String, default: () => `seller_${crypto.randomUUID()}` },
    userId: { type: String, required: true, unique: true, index: true },
    businessName: { type: String, required: true, trim: true },
    businessRegistrationNumber: { type: String, trim: true },
    taxId: { type: String, trim: true },
    gstin: { type: String, trim: true },
    pan: { type: String, trim: true },
    ifsc: { type: String, trim: true },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    contactPhone: { type: String, default: '+91 99999 99999', trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING',
      index: true,
    },
    rejectionReason: { type: String },
    commissionRateOverride: { type: Number },
    bankDetails: {
      accountHolder: { type: String },
      accountNumberMasked: { type: String },
      routingOrIfsc: { type: String },
      bankName: { type: String },
    },
    appliedAt: { type: Date, default: () => new Date() },
    approvedAt: { type: Date },
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

SellerProfileSchema.virtual('id').get(function () {
  return this._id;
});

export const SellerProfileModel: Model<ISellerProfile> =
  mongoose.models.SellerProfile ||
  mongoose.model<ISellerProfile>('SellerProfile', SellerProfileSchema);
