import mongoose, { Schema, type Model } from 'mongoose';

export interface ICoupon {
  _id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderValuePaise: number;
  maxDiscountPaise?: number;
  expiresAt: Date;
  usageLimit: number;
  timesUsed: number;
  perUserLimit: number;
  usedByUsers: { userId: string; count: number }[];
  sellerId?: string;
  categoryId?: string;
  isActive: boolean;
  createdAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    discountType: { type: String, enum: ['PERCENTAGE', 'FIXED'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValuePaise: { type: Number, default: 0, min: 0 },
    maxDiscountPaise: { type: Number },
    expiresAt: { type: Date, required: true },
    usageLimit: { type: Number, default: 1000 },
    timesUsed: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    usedByUsers: [
      {
        userId: { type: String, required: true },
        count: { type: Number, default: 1 },
      },
    ],
    sellerId: { type: String, index: true },
    categoryId: { type: String, index: true },
    isActive: { type: Boolean, default: true, index: true },
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

CouponSchema.virtual('id').get(function () {
  return this._id;
});

export const CouponModel: Model<ICoupon> =
  mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema);
