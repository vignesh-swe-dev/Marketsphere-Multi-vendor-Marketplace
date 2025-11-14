import mongoose, { Schema, type Model } from 'mongoose';
import crypto from 'node:crypto';
import type { UserRole } from '../types/index.ts';

export interface IUserAddress {
  id: string;
  fullName: string;
  phone?: string;
  streetAddress: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface IUser {
  _id: string;
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  passwordHash?: string;
  isBlocked: boolean;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  addresses: IUserAddress[];
  wishlist: string[]; // Product IDs
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IUserAddress>(
  {
    id: { type: String, default: () => `addr_${crypto.randomUUID()}` },
    fullName: { type: String, required: true },
    phone: { type: String },
    streetAddress: { type: String, required: true },
    landmark: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, default: () => `usr_${crypto.randomUUID()}` },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['CUSTOMER', 'SELLER', 'ADMIN', 'SUPPORT'],
      default: 'CUSTOMER',
      index: true,
    },
    phone: { type: String },
    avatarUrl: { type: String },
    passwordHash: { type: String },
    isBlocked: { type: Boolean, default: false, index: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date },
    addresses: [AddressSchema],
    wishlist: [{ type: String, ref: 'Product' }],
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
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

UserSchema.virtual('id').get(function () {
  return this._id;
});

// Enforce single-Admin invariant at the database level
UserSchema.pre('save', async function () {
  if (this.isModified('role') && this.role === 'ADMIN') {
    const existingAdmin = await (this.constructor as Model<IUser>).findOne({
      role: 'ADMIN',
      _id: { $ne: this._id },
    });
    if (existingAdmin) {
      throw new Error('Only one Admin account is permitted in the system.');
    }
  }
});

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
