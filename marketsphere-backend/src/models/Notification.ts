import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface INotification {
  _id: string;
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    _id: { type: String, default: () => `notif_${crypto.randomUUID()}` },
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    data: { type: Schema.Types.Mixed },
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

NotificationSchema.virtual('id').get(function () {
  return this._id;
});

NotificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationModel: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);
