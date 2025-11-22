import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface ICommissionRule {
  _id: string;
  id: string;
  scope: 'DEFAULT' | 'CATEGORY' | 'SELLER';
  targetId?: string;
  targetName?: string;
  percentageRate: number;
  description: string;
  effectiveDate: Date;
  createdAt: Date;
}

const CommissionRuleSchema = new Schema<ICommissionRule>(
  {
    _id: { type: String, default: () => `comm_${crypto.randomUUID()}` },
    scope: { type: String, enum: ['DEFAULT', 'CATEGORY', 'SELLER'], required: true },
    targetId: { type: String, index: true },
    targetName: { type: String },
    percentageRate: { type: Number, required: true },
    description: { type: String, default: '' },
    effectiveDate: { type: Date, default: () => new Date() },
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

CommissionRuleSchema.virtual('id').get(function () {
  return this._id;
});

export const CommissionRuleModel: Model<ICommissionRule> =
  mongoose.models.CommissionRule ||
  mongoose.model<ICommissionRule>('CommissionRule', CommissionRuleSchema);
