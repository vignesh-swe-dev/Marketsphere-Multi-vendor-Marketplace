import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';

export interface IAuditLog {
  _id: string;
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    _id: { type: String, default: () => `audit_${crypto.randomUUID()}` },
    actorId: { type: String, required: true, index: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: () => new Date(), index: true },
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

AuditLogSchema.virtual('id').get(function () {
  return this._id;
});

AuditLogSchema.index({ targetType: 1, targetId: 1 });

export const AuditLogModel: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
