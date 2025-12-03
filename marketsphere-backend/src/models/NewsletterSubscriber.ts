import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface INewsletterSubscriber {
  _id: string;
  id: string;
  email: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const NewsletterSubscriberSchema = new Schema<INewsletterSubscriber>(
  {
    _id: { type: String, default: () => `sub_${crypto.randomUUID()}` },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      default: 'footer',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'newsletter_subscribers',
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

NewsletterSubscriberSchema.virtual('id').get(function () {
  return this._id;
});

export const NewsletterSubscriberModel: Model<INewsletterSubscriber> =
  mongoose.models.NewsletterSubscriber ||
  mongoose.model<INewsletterSubscriber>('NewsletterSubscriber', NewsletterSubscriberSchema);
