// All *Paise fields are in the currency's minor unit; for INR that is paise (100 paise = ₹1)

export type UserRole = 'CUSTOMER' | 'SELLER' | 'ADMIN' | 'SUPPORT';

export type SellerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type ProductStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

export type OrderStatus = 
  | 'PENDING_PAYMENT' 
  | 'PAID' 
  | 'PROCESSING' 
  | 'SHIPPED' 
  | 'DELIVERED' 
  | 'CANCELLED' 
  | 'REFUND_REQUESTED' 
  | 'REFUNDED' 
  | 'PARTIALLY_REFUNDED'
  | 'DISPUTED';

export type PaymentStatus = 
  | 'INITIATED' 
  | 'AUTHORIZED' 
  | 'CAPTURED' 
  | 'FAILED' 
  | 'REFUNDED' 
  | 'PARTIALLY_REFUNDED';

export type LedgerEntryType = 
  | 'GROSS_SALE' 
  | 'MARKETPLACE_COMMISSION' 
  | 'SELLER_PAYABLE' 
  | 'TAX_COLLECTED' 
  | 'SHIPPING_COLLECTED' 
  | 'REFUND_MERCHANDISE' 
  | 'REFUND_COMMISSION_REVERSAL' 
  | 'SELLER_PAYOUT';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
  sellerProfileId?: string;
  sellerStatus?: SellerStatus;
  shopId?: string;
}

export interface Address {
  id: string;
  userId?: string;
  fullName: string;
  phone?: string;
  streetAddress: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string; // Indian 6-digit PIN code
  country: string;
  isDefault?: boolean;
}

export interface SellerProfile {
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
  appliedAt: string;
  approvedAt?: string;
  commissionRateOverride?: number;
  bankDetails?: {
    accountHolder: string;
    accountNumberMasked: string;
    routingOrIfsc: string;
    bankName: string;
  };
}

export interface Shop {
  id: string;
  sellerId: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  shippingPolicy: string;
  refundPolicy: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName?: string;
  defaultCommissionRate: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  pricePaise: number;
  priceCents?: number;
  compareAtPricePaise?: number;
  compareAtPriceCents?: number;
  inventoryQuantity: number;
  attributes: Record<string, string>;
}

export interface Product {
  id: string;
  shopId: string;
  sellerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  images: string[];
  basePricePaise: number;
  basePriceCents?: number;
  sku: string;
  brand: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  inventoryTotal: number;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
  shopName?: string;
  categoryName?: string;
  shopSlug?: string;
  shippingPolicy?: string;
  refundPolicy?: string;
  reviews?: Review[];
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  product: Product;
  selectedVariant?: ProductVariant;
}

export interface Cart {
  items: CartItem[];
  subtotalPaise: number;
  subtotalCents?: number;
  shippingPaise: number;
  shippingCents?: number;
  taxPaise: number;
  taxCents?: number;
  discountPaise: number;
  discountCents?: number;
  totalPaise: number;
  totalCents?: number;
  couponCode?: string;
}

export interface OrderItemSnapshot {
  id: string;
  sellerOrderId: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  variantName?: string;
  unitPricePaise: number;
  unitPriceCents?: number;
  quantity: number;
  totalPaise: number;
  totalCents?: number;
  allocatedDiscountPaise: number;
  allocatedDiscountCents?: number;
  taxPaise: number;
  taxCents?: number;
  commissionRate: number;
  commissionAmountPaise: number;
  commissionAmountCents?: number;
  sellerPayablePaise: number;
  sellerPayableCents?: number;
  imageUrl?: string;
}

export interface SellerOrder {
  id: string;
  parentOrderId: string;
  sellerId: string;
  shopId: string;
  shopName: string;
  subtotalPaise: number;
  subtotalCents?: number;
  shippingPaise: number;
  shippingCents?: number;
  taxPaise: number;
  taxCents?: number;
  discountPaise: number;
  discountCents?: number;
  totalPaise: number;
  totalCents?: number;
  commissionTotalPaise: number;
  commissionTotalCents?: number;
  sellerNetPayablePaise: number;
  sellerNetPayableCents?: number;
  status: OrderStatus;
  shippingCarrier?: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  items: OrderItemSnapshot[];
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  subtotalPaise: number;
  subtotalCents?: number;
  shippingPaise: number;
  shippingCents?: number;
  taxPaise: number;
  taxCents?: number;
  discountPaise: number;
  discountCents?: number;
  totalPaise: number;
  totalCents?: number;
  currency: string;
  shippingAddress: Address;
  paymentMethod: string;
  paymentId?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  invoiceUrl?: string;
  createdAt: string;
  updatedAt: string;
  sellerOrders: SellerOrder[];
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: 'SANDBOX' | 'RAZORPAY' | 'STRIPE';
  providerPaymentId: string;
  amountPaise: number;
  amountCents?: number;
  currency: string;
  status: PaymentStatus;
  idempotencyKey: string;
  signatureVerified: boolean;
  rawPayload?: Record<string, unknown>;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  sellerId?: string;
  orderId?: string;
  type: LedgerEntryType;
  debitPaise: number;
  debitCents?: number;
  creditPaise: number;
  creditCents?: number;
  description: string;
  createdAt: string;
}

export interface LedgerBalance {
  sellerId: string;
  pendingPaise: number;
  pendingCents?: number;
  availablePaise: number;
  availableCents?: number;
  paidOutPaise: number;
  paidOutCents?: number;
  refundedPaise: number;
  refundedCents?: number;
  totalEarningsPaise: number;
  totalEarningsCents?: number;
}

export interface CommissionRule {
  id: string;
  scope: 'DEFAULT' | 'CATEGORY' | 'SELLER';
  targetId?: string;
  targetName?: string;
  percentageRate: number;
  description: string;
  effectiveDate: string;
  target_id?: string;
  percentage_rate?: number;
  effective_date?: string;
}

export interface Coupon {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderValuePaise: number;
  minOrderValueCents?: number;
  maxDiscountPaise?: number;
  maxDiscountCents?: number;
  expiresAt: string;
  usageLimit: number;
  timesUsed: number;
  sellerId?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  sellerReply?: {
    comment: string;
    repliedAt: string;
  };
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}
