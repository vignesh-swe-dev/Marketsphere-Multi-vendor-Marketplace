import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface ICategory {
  _id: string;
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  defaultCommissionRate: number;
}

const CategorySchema = new Schema<ICategory>(
  {
    _id: { type: String, default: () => `cat_${crypto.randomUUID()}` },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String },
    iconName: { type: String },
    defaultCommissionRate: { type: Number, default: 0.10 },
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

CategorySchema.virtual('id').get(function () {
  return this._id;
});

export const CategoryModel: Model<ICategory> =
  mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);
