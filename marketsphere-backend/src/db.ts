/**
 * Database connection, transaction management, and seed engine for MarketSphere.
 * Backed by MongoDB Atlas via Mongoose.
 * Connection string comes strictly from MONGODB_URI in .env (never hardcoded).
 * All monetary amounts are stored in minor units: for INR that is paise (100 paise = ₹1).
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  UserModel,
  SellerProfileModel,
  ShopModel,
  CategoryModel,
  ProductModel,
  ProductVariantModel,
  InventoryModel,
  OrderModel,
  SellerOrderModel,
  OrderItemModel,
  CouponModel,
  CommissionRuleModel,
  LedgerEntryModel,
  PaymentModel,
  ReviewModel,
  AuditLogModel,
} from './models/index.ts';
import { createOrderLedgerPostings } from './lib/ledger.ts';
import { CURRENCY, GST_RATE_PERCENT, FLAT_SHIPPING_PAISE } from './config.ts';
import { startLocalMongo, type LocalMongoHandle } from './localMongo.ts';

let isConnecting = false;
let localMongo: LocalMongoHandle | null = null;
let dbMode: 'atlas' | 'local' | 'explicit' | null = null;

/** Which database the server is using: 'atlas' (MONGODB_URI), 'local' (built-in), or null if not connected. */
export function getDbMode() {
  return dbMode;
}

/** Hide the password in a connection string so it is safe to print. */
function maskUri(uri: string) {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:****@');
}

/**
 * Connects to MongoDB with Mongoose.
 *
 *   MONGODB_URI set   -> that database (MongoDB Atlas or any MongoDB server)
 *   MONGODB_URI empty -> local mode: a real MongoDB stored in ./data/mongo (development only)
 *
 * An explicit `uri` argument (used by tests) wins over both.
 */
export async function connectDB(uri?: string): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  if (isConnecting) {
    while (isConnecting) await new Promise((resolve) => setTimeout(resolve, 50));
    return mongoose;
  }

  isConnecting = true;
  try {
    let connectionUri = uri || process.env.MONGODB_URI?.trim();

    if (uri) {
      dbMode = 'explicit';
    } else if (connectionUri) {
      dbMode = 'atlas';
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('MONGODB_URI is required when NODE_ENV=production. Set it in the environment.');
      }
      localMongo = await startLocalMongo();
      connectionUri = localMongo.uri;
      dbMode = 'local';
    }

    await mongoose.connect(connectionUri!, { serverSelectionTimeoutMS: 15000 });

    if (dbMode === 'local') {
      console.log(`[DB] Connected to the built-in local MongoDB (data folder: ${localMongo!.dir})`);
    } else {
      console.log(`[DB] Connected to MongoDB: ${maskUri(connectionUri!)}`);
    }

    // Demo data only for an empty database in development (or when SEED_DEMO_DATA=true).
    // It is never created automatically in production: demo accounts have a publicly known password.
    const count = await UserModel.countDocuments();
    const allowSeed = process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DATA === 'true';
    if (count === 0 && allowSeed && !uri) {
      await seedDatabase();
    } else if (count === 0 && !uri) {
      console.warn('[DB] The database is empty. Create the first admin with: npm run create-admin');
    }

    return mongoose;
  } catch (err: any) {
    console.error('[DB ERROR] Failed to connect to MongoDB:', err?.message || err);
    if (dbMode === 'atlas') {
      console.error(
        '          Check MONGODB_URI in backend/.env, your internet connection, and (for Atlas) that your IP\n' +
          '          address is allowed under Network Access. To use the built-in local database instead,\n' +
          '          remove or comment out MONGODB_URI.'
      );
    }
    await localMongo?.stop().catch(() => {});
    localMongo = null;
    dbMode = null;
    throw err;
  } finally {
    isConnecting = false;
  }
}

/**
 * Disconnects from MongoDB cleanly.
 */
export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB.');
  }
  if (localMongo) {
    await localMongo.stop().catch(() => {});
    localMongo = null;
  }
  dbMode = null;
}

/**
 * Executes an operation within a MongoDB multi-document transaction session.
 * Automatically falls back to session-less execution if the MongoDB instance is a standalone
 * single node that doesn't support replica set transactions.
 */
export async function withTransaction<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    // Check if replica set transactions are supported
    const isReplica = (mongoose.connection as any).client?.topology?.description?.type !== 'Single';
    if (isReplica) {
      session.startTransaction();
      try {
        result = await fn(session);
        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      }
    } else {
      // Standalone node fallback (e.g. basic local mongod)
      result = await fn(null);
    }
    return result;
  } catch (err: any) {
    // If startTransaction failed because not a replica set, retry without session
    if (err?.message?.includes('Transactions are not supported') || err?.codeName === 'IllegalOperation') {
      return await fn(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

/**
 * Resets and clears all collections in the database.
 */
export async function resetDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  const collections = mongoose.connection.collections;
  for (const key in collections) {
    try {
      await collections[key].deleteMany({});
    } catch (e) {
      // Collection might not exist yet
    }
  }
  console.log('[DB] Database reset complete (all collections cleared).');
}

/**
 * Seeds the database with rich, realistic Indian demo data in INR / Paise minor units.
 */
export async function seedDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  // Clear existing records before seeding
  await resetDatabase();

  console.log('[DB] Seeding Indian marketplace data (INR / Paise)...');

  const demoPasswordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'Demo@12345', 12);
  const now = new Date();

  // 1. Users
  const users = await UserModel.create([
    {
      _id: 'user-admin-1',
      email: 'admin@marketsphere.in',
      fullName: 'Aarav Patel (Admin)',
      role: 'ADMIN',
      phone: '+91 98200 11223',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      passwordHash: demoPasswordHash,
      addresses: [],
    },
    {
      _id: 'user-seller-1',
      email: 'seller@apexelectronics.com',
      fullName: 'Rajesh Sharma (Apex Electronics)',
      role: 'SELLER',
      phone: '+91 98123 45678',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      passwordHash: demoPasswordHash,
      addresses: [],
    },
    {
      _id: 'user-seller-2',
      email: 'seller@luminaliving.com',
      fullName: 'Ananya Desai (Lumina Living)',
      role: 'SELLER',
      phone: '+91 98234 56789',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      passwordHash: demoPasswordHash,
      addresses: [],
    },
    {
      _id: 'user-seller-3',
      email: 'applicant@zenith.com',
      fullName: 'Vikram Malhotra (Zenith Gear)',
      role: 'SELLER',
      phone: '+91 98345 67890',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      passwordHash: demoPasswordHash,
      addresses: [],
    },
    {
      _id: 'user-customer-1',
      email: 'customer@example.com',
      fullName: 'Sarah Connor',
      role: 'CUSTOMER',
      phone: '+91 98456 78901',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      passwordHash: demoPasswordHash,
      addresses: [
        {
          id: 'addr-1',
          fullName: 'Sarah Connor',
          phone: '+91 98456 78901',
          streetAddress: 'Flat 402, Lotus Heights, Indiranagar',
          landmark: 'Near Metro Station',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'India',
          isDefault: true,
        },
      ],
    },
    {
      _id: 'user-customer-2',
      email: 'priya.sharma@example.in',
      fullName: 'Priya Sharma',
      role: 'CUSTOMER',
      phone: '+91 98567 89012',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      passwordHash: demoPasswordHash,
      addresses: [
        {
          id: 'addr-2',
          fullName: 'Priya Sharma',
          phone: '+91 98567 89012',
          streetAddress: 'B-12 Sea View Apartments, Bandra West',
          landmark: 'Opposite Bandstand',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400050',
          country: 'India',
          isDefault: true,
        },
      ],
    },
    {
      _id: 'user-support-1',
      email: 'support@marketsphere.in',
      fullName: 'MarketSphere Support Desk',
      role: 'SUPPORT',
      phone: '+91 1800 123 4567',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      passwordHash: demoPasswordHash,
      addresses: [],
    },
  ]);

  // 2. Seller Profiles
  await SellerProfileModel.create([
    {
      _id: 'seller-prof-1',
      userId: 'user-seller-1',
      businessName: 'Apex Electronics Private Limited',
      businessRegistrationNumber: '29ABCDE1234F1Z5',
      taxId: 'ABCDE1234F',
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      ifsc: 'HDFC0001234',
      contactEmail: 'support@apexelectronics.com',
      contactPhone: '+91 98123 45678',
      status: 'APPROVED',
      commissionRateOverride: 0.08, // VIP 8% commission override
      bankDetails: {
        accountHolder: 'Apex Electronics Private Limited',
        bankName: 'HDFC Bank',
        accountNumberMasked: '••••4820',
        routingOrIfsc: 'HDFC0001234',
      },
      appliedAt: new Date('2026-08-10T09:00:00Z'),
      approvedAt: new Date('2026-08-11T14:30:00Z'),
    },
    {
      _id: 'seller-prof-2',
      userId: 'user-seller-2',
      businessName: 'Lumina Living Studio LLP',
      businessRegistrationNumber: '27AABCL5678M1Z2',
      taxId: 'AABCL5678M',
      gstin: '27AABCL5678M1Z2',
      pan: 'AABCL5678M',
      ifsc: 'ICIC0000104',
      contactEmail: 'hello@luminaliving.com',
      contactPhone: '+91 98234 56789',
      status: 'APPROVED',
      commissionRateOverride: undefined, // standard category rate
      bankDetails: {
        accountHolder: 'Lumina Living Studio LLP',
        bankName: 'ICICI Bank',
        accountNumberMasked: '••••9182',
        routingOrIfsc: 'ICIC0000104',
      },
      appliedAt: new Date('2026-09-01T10:00:00Z'),
      approvedAt: new Date('2026-09-02T16:00:00Z'),
    },
    {
      _id: 'seller-prof-3',
      userId: 'user-seller-3',
      businessName: 'Zenith Athletics & Tech Gear India',
      businessRegistrationNumber: '33AAACZ9876K1ZY',
      taxId: 'AAACZ9876K',
      gstin: '33AAACZ9876K1ZY',
      pan: 'AAACZ9876K',
      ifsc: 'SBIN0004567',
      contactEmail: 'applicant@zenith.com',
      contactPhone: '+91 98345 67890',
      status: 'PENDING',
      appliedAt: new Date('2026-10-15T08:45:00Z'),
    },
  ]);

  // 3. Shops
  await ShopModel.create([
    {
      _id: 'shop-1',
      sellerId: 'seller-prof-1',
      name: 'Apex Electronics',
      slug: 'apex-electronics',
      tagline: 'Premium Audio & Smart Devices with 1-Year National Warranty',
      description:
        'Official distributor for certified audiophile equipment, noise-cancelling headphones, and smart acoustics in India. Authorized service network across 40+ cities.',
      logoUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=200',
      bannerUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200',
      shippingPolicy: 'Dispatched within 24 hours via Blue Dart Air Express. Delivery in 2-4 business days.',
      refundPolicy: '7-day replacement guarantee for manufacturing defects. 1-year brand warranty.',
      rating: 4.8,
      reviewCount: 142,
      isActive: true,
    },
    {
      _id: 'shop-2',
      sellerId: 'seller-prof-2',
      name: 'Lumina Living Studio',
      slug: 'lumina-living',
      tagline: 'Artisanal Home Decor, Handcrafted Ceramics & Ergonomic Furniture',
      description:
        'Sustainably sourced, modern minimalist home accessories crafted by traditional artisans in Rajasthan and Karnataka.',
      logoUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200',
      bannerUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200',
      shippingPolicy: 'Shipped via Delhivery Surface with specialized shockproof packaging. 3-6 days across India.',
      refundPolicy: '10-day return policy for unused items in original packaging.',
      rating: 4.9,
      reviewCount: 98,
      isActive: true,
    },
    {
      _id: 'shop-3',
      sellerId: 'seller-prof-3',
      name: 'Zenith Sports & Gear',
      slug: 'zenith-gear',
      tagline: 'Performance Fitness, Smart Wearables & Outdoor Essentials',
      description:
        'Engineered training apparel, GPS trackers, and high-durability trekking equipment designed for Indian terrain.',
      logoUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=200',
      bannerUrl: 'https://images.unsplash.com/photo-1434596922112-19c563067271?w=1200',
      shippingPolicy: 'Standard courier delivery via India Post Speed Post / Delhivery.',
      refundPolicy: '15-day exchange on apparel sizes.',
      rating: 5.0,
      reviewCount: 0,
      isActive: false, // Pending seller
    },
  ]);

  // 4. Categories
  await CategoryModel.create([
    {
      _id: 'cat-electronics',
      name: 'Electronics & Audio',
      slug: 'electronics',
      description: 'Headphones, amplifiers, smart speakers, and peripherals',
      iconName: 'Headphones',
      defaultCommissionRate: 0.10, // 10%
    },
    {
      _id: 'cat-home',
      name: 'Home & Kitchen',
      slug: 'home-kitchen',
      description: 'Lighting, ceramics, cookware, and interior decor',
      iconName: 'Home',
      defaultCommissionRate: 0.12, // 12%
    },
    {
      _id: 'cat-fashion',
      name: 'Fashion & Apparel',
      slug: 'fashion',
      description: 'Premium organic cotton apparel and designer accessories',
      iconName: 'Shirt',
      defaultCommissionRate: 0.15, // 15%
    },
    {
      _id: 'cat-beauty',
      name: 'Beauty & Wellness',
      slug: 'beauty',
      description: 'Ayurvedic formulations and natural wellness essentials',
      iconName: 'Sparkles',
      defaultCommissionRate: 0.14, // 14%
    },
    {
      _id: 'cat-sports',
      name: 'Sports & Outdoors',
      slug: 'sports',
      description: 'Fitness trackers, gym equipment, and trekking kits',
      iconName: 'Activity',
      defaultCommissionRate: 0.10, // 10%
    },
  ]);

  // 5. Products & Variants & Inventory
  const productsData = [
    {
      _id: 'prod-1',
      shopId: 'shop-1',
      sellerId: 'seller-prof-1',
      categoryId: 'cat-electronics',
      name: 'Apex Wave Noise-Cancelling Wireless Headphones',
      slug: 'apex-wave-wireless-headphones',
      description:
        'Industry-leading active noise cancellation tuned for Indian urban environments. 40-hour battery life with fast Type-C charging, multipoint Bluetooth 5.3, and custom 40mm beryllium drivers.',
      status: 'PUBLISHED',
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800',
      ],
      basePricePaise: 2399900, // ₹23,999.00
      sku: 'APX-WAVE-001',
      brand: 'Apex Acoustics',
      tags: ['audio', 'wireless', 'anc', 'headphones', 'bluetooth'],
      rating: 4.8,
      reviewCount: 84,
      inventoryTotal: 42,
      variants: [
        {
          _id: 'var-1-1',
          productId: 'prod-1',
          name: 'Matte Charcoal / Standard',
          sku: 'APX-WAVE-BLK',
          pricePaise: 2399900,
          compareAtPricePaise: 2999900,
          inventoryQuantity: 28,
          attributes: { Color: 'Matte Charcoal' },
        },
        {
          _id: 'var-1-2',
          productId: 'prod-1',
          name: 'Arctic Silver / Standard',
          sku: 'APX-WAVE-SLV',
          pricePaise: 2499900,
          compareAtPricePaise: 2999900,
          inventoryQuantity: 14,
          attributes: { Color: 'Arctic Silver' },
        },
      ],
    },
    {
      _id: 'prod-2',
      shopId: 'shop-1',
      sellerId: 'seller-prof-1',
      categoryId: 'cat-electronics',
      name: 'Apex Pulse Hi-Fi Desktop DAC & Headphone Amp',
      slug: 'apex-pulse-desktop-dac-amp',
      description:
        'Audiophile-grade 32-bit/768kHz PCM and DSD512 decoder with dual ES9038Q2M SABRE DACs. Balanced 4.4mm output and single-ended 6.35mm jack for planar magnetic headphones.',
      status: 'PUBLISHED',
      images: ['https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800'],
      basePricePaise: 1499900, // ₹14,999.00
      sku: 'APX-DAC-002',
      brand: 'Apex Acoustics',
      tags: ['audiophile', 'dac', 'amp', 'hifi', 'desktop'],
      rating: 4.9,
      reviewCount: 38,
      inventoryTotal: 19,
      variants: [
        {
          _id: 'var-2-1',
          productId: 'prod-2',
          name: 'Anodized Black',
          sku: 'APX-DAC-BLK',
          pricePaise: 1499900,
          compareAtPricePaise: 1799900,
          inventoryQuantity: 19,
          attributes: { Finish: 'Anodized Black' },
        },
      ],
    },
    {
      _id: 'prod-3',
      shopId: 'shop-2',
      sellerId: 'seller-prof-2',
      categoryId: 'cat-home',
      name: 'Handcrafted Terracotta Ceramic Pour-Over Carafe Set',
      slug: 'handcrafted-terracotta-ceramic-carafe-set',
      description:
        'Locally sourced clay from Ramanagara, Karnataka, hand-thrown and kiln-glazed with food-safe non-toxic matte glaze. Includes dripper cone, heat-resistant carafe, and 2 tasting cups.',
      status: 'PUBLISHED',
      images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800'],
      basePricePaise: 249900, // ₹2,499.00
      sku: 'LUM-CER-003',
      brand: 'Lumina Craft',
      tags: ['coffee', 'ceramic', 'handmade', 'sustainable', 'kitchen'],
      rating: 4.9,
      reviewCount: 45,
      inventoryTotal: 30,
      variants: [
        {
          _id: 'var-3-1',
          productId: 'prod-3',
          name: 'Sandstone Grey (500ml)',
          sku: 'LUM-CER-SND',
          pricePaise: 249900,
          compareAtPricePaise: 299900,
          inventoryQuantity: 18,
          attributes: { Color: 'Sandstone Grey', Capacity: '500ml' },
        },
        {
          _id: 'var-3-2',
          productId: 'prod-3',
          name: 'Earthy Terracotta (500ml)',
          sku: 'LUM-CER-TER',
          pricePaise: 249900,
          compareAtPricePaise: 299900,
          inventoryQuantity: 12,
          attributes: { Color: 'Earthy Terracotta', Capacity: '500ml' },
        },
      ],
    },
    {
      _id: 'prod-4',
      shopId: 'shop-2',
      sellerId: 'seller-prof-2',
      categoryId: 'cat-home',
      name: 'Minimalist Brass Table Lamp with Dimmable LED',
      slug: 'minimalist-brass-table-lamp',
      description:
        'Solid brass body with spun metal shade, tactile rotary dimmer, and warm 2700K ambient LED. Hand-polished in Moradabad.',
      status: 'PUBLISHED',
      images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800'],
      basePricePaise: 549900, // ₹5,499.00
      sku: 'LUM-LMP-004',
      brand: 'Lumina Studio',
      tags: ['lighting', 'brass', 'decor', 'minimalist', 'lamp'],
      rating: 4.7,
      reviewCount: 29,
      inventoryTotal: 25,
      variants: [
        {
          _id: 'var-4-1',
          productId: 'prod-4',
          name: 'Brushed Brass',
          sku: 'LUM-LMP-BRS',
          pricePaise: 549900,
          compareAtPricePaise: 649900,
          inventoryQuantity: 15,
          attributes: { Finish: 'Brushed Brass' },
        },
        {
          _id: 'var-4-2',
          productId: 'prod-4',
          name: 'Matte Brass Mini Accessory (Small)',
          sku: 'LUM-LMP-MINI',
          pricePaise: 74900, // ₹749.00 (below ₹999 for shipping test)
          compareAtPricePaise: 99900,
          inventoryQuantity: 10,
          attributes: { Finish: 'Mini Accessory' },
        },
      ],
    },
  ];

  for (const p of productsData) {
    const { variants, ...prodFields } = p;
    await ProductModel.create(prodFields as any);

    for (const v of variants) {
      await ProductVariantModel.create(v);
      await InventoryModel.create({
        _id: `inv_${v._id}`,
        stockItemId: v._id,
        productId: p._id,
        sellerId: p.sellerId,
        totalQuantity: v.inventoryQuantity,
        reservedQuantity: 0,
      });
    }
  }

  // 6. Commission Rules
  await CommissionRuleModel.create([
    {
      _id: 'comm-rule-default',
      scope: 'DEFAULT',
      percentageRate: 10.0,
      description: 'Marketplace default standard commission rate (10%)',
      effectiveDate: new Date('2026-01-01T00:00:00Z'),
    },
    {
      _id: 'comm-rule-home',
      scope: 'CATEGORY',
      targetId: 'cat-home',
      targetName: 'Home & Kitchen',
      percentageRate: 12.0,
      description: 'Category commission for Home & Kitchen (12%)',
      effectiveDate: new Date('2026-01-01T00:00:00Z'),
    },
    {
      _id: 'comm-rule-apex',
      scope: 'SELLER',
      targetId: 'seller-prof-1',
      targetName: 'Apex Electronics',
      percentageRate: 8.0,
      description: 'VIP Seller preferred platform commission rate (8%)',
      effectiveDate: new Date('2026-01-01T00:00:00Z'),
    },
  ]);

  // 7. Coupons
  await CouponModel.create([
    {
      _id: 'WELCOME10',
      code: 'WELCOME10',
      discountType: 'PERCENTAGE',
      discountValue: 10, // 10%
      minOrderValuePaise: 99900, // ₹999 min order
      maxDiscountPaise: 150000, // ₹1,500 max cap
      expiresAt: new Date('2027-12-31T23:59:59Z'),
      usageLimit: 10000,
      timesUsed: 142,
      perUserLimit: 1,
      usedByUsers: [],
      isActive: true,
    },
    {
      _id: 'SAVE25',
      code: 'SAVE25',
      discountType: 'FIXED',
      discountValue: 25000, // ₹250.00 off
      minOrderValuePaise: 150000, // Min ₹1,500 order
      expiresAt: new Date('2027-12-31T23:59:59Z'),
      usageLimit: 5000,
      timesUsed: 89,
      perUserLimit: 2,
      usedByUsers: [],
      isActive: true,
    },
    {
      _id: 'FESTIVE20',
      code: 'FESTIVE20',
      discountType: 'PERCENTAGE',
      discountValue: 20, // 20%
      minOrderValuePaise: 250000, // Min ₹2,500 order
      maxDiscountPaise: 300000, // ₹3,000 max cap
      expiresAt: new Date('2027-12-31T23:59:59Z'),
      usageLimit: 2000,
      timesUsed: 44,
      perUserLimit: 1,
      usedByUsers: [],
      isActive: true,
    },
  ]);

  // 8. Orders, Seller Orders, Order Items, and Balanced Ledger Postings
  // Order 1001: Customer Sarah buys Apex Wave (prod-1)
  // Subtotal = 2399900 paise (₹23,999), Shipping = ₹0 (free above ₹999), Discount = 0
  // Tax (18% GST) = 431982 paise (₹4,319.82)
  // Total = 2831882 paise (₹28,318.82)
  // Commission (8% VIP rate on 2399900) = 191992 paise
  // Seller Net Payable = 2399900 - 191992 = 2207908 paise
  const order1Address = {
    fullName: 'Sarah Connor',
    phone: '+91 98456 78901',
    streetAddress: 'Flat 402, Lotus Heights, Indiranagar',
    landmark: 'Near Metro Station',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
  };

  await OrderModel.create({
    _id: 'ord-1001',
    orderNumber: 'MS-2026-1001',
    customerId: 'user-customer-1',
    customerName: 'Sarah Connor',
    customerEmail: 'customer@example.com',
    status: 'SHIPPED',
    subtotalPaise: 2399900,
    shippingPaise: 0,
    taxPaise: 431982,
    discountPaise: 0,
    totalPaise: 2831882,
    currency: 'INR',
    shippingAddress: order1Address,
    paymentMethod: 'SANDBOX',
    paymentId: 'sbx_pi_ord1001_seed',
    trackingNumber: 'BLUDART-8829104',
    shippingCarrier: 'Blue Dart Air Express',
    createdAt: new Date('2026-10-18T10:00:00Z'),
  });

  await SellerOrderModel.create({
    _id: 'subord-apex-1',
    parentOrderId: 'ord-1001',
    sellerId: 'seller-prof-1',
    shopId: 'shop-1',
    shopName: 'Apex Electronics',
    subtotalPaise: 2399900,
    shippingPaise: 0,
    taxPaise: 431982,
    discountPaise: 0,
    totalPaise: 2831882,
    commissionTotalPaise: 191992,
    sellerNetPayablePaise: 2207908,
    status: 'SHIPPED',
    shippingCarrier: 'Blue Dart Air Express',
    trackingNumber: 'BLUDART-8829104',
    shippedAt: new Date('2026-10-18T16:00:00Z'),
    createdAt: new Date('2026-10-18T10:00:00Z'),
  });

  await OrderItemModel.create({
    _id: 'item-1-1',
    sellerOrderId: 'subord-apex-1',
    orderId: 'ord-1001',
    productId: 'prod-1',
    variantId: 'var-1-1',
    productName: 'Apex Wave Noise-Cancelling Wireless Headphones',
    sku: 'APX-WAVE-BLK',
    variantName: 'Matte Charcoal / Standard',
    unitPricePaise: 2399900,
    quantity: 1,
    totalPaise: 2399900,
    allocatedDiscountPaise: 0,
    taxPaise: 431982,
    commissionRate: 0.08,
    commissionAmountPaise: 191992,
    sellerPayablePaise: 2207908,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
    createdAt: new Date('2026-10-18T10:00:00Z'),
  });

  // Balanced Ledger Postings for ord-1001
  const postings1001 = createOrderLedgerPostings({
    orderId: 'ord-1001',
    sellerId: 'seller-prof-1',
    grossPaise: 2831882,
    sellerPayablePaise: 2207908,
    commissionPaise: 191992,
    taxPaise: 431982,
    shippingPaise: 0,
  });

  for (const p of postings1001) {
    await LedgerEntryModel.create({
      transactionId: 'tx_ord1001_seed',
      sellerId: p.sellerId,
      orderId: p.orderId,
      type: p.type,
      debitPaise: p.debitPaise,
      creditPaise: p.creditPaise,
      description: p.description,
      createdAt: new Date('2026-10-18T10:00:00Z'),
    });
  }

  // Order 1002: Customer Priya buys Lumina Living Carafe (prod-3)
  // Subtotal = 249900 paise (₹2,499), Shipping = ₹0, Discount = 0
  // Tax (18% GST) = 44982 paise (₹449.82)
  // Total = 294882 paise (₹2,948.82)
  // Commission (12% Category rate on 249900) = 29988 paise
  // Seller Net Payable = 249900 - 29988 = 219912 paise
  await OrderModel.create({
    _id: 'ord-1002',
    orderNumber: 'MS-2026-1002',
    customerId: 'user-customer-2',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.in',
    status: 'DELIVERED',
    subtotalPaise: 249900,
    shippingPaise: 0,
    taxPaise: 44982,
    discountPaise: 0,
    totalPaise: 294882,
    currency: 'INR',
    shippingAddress: {
      fullName: 'Priya Sharma',
      phone: '+91 98567 89012',
      streetAddress: 'B-12 Sea View Apartments, Bandra West',
      landmark: 'Opposite Bandstand',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400050',
      country: 'India',
    },
    paymentMethod: 'SANDBOX',
    paymentId: 'sbx_pi_ord1002_seed',
    trackingNumber: 'DELHIVERY-9948201',
    shippingCarrier: 'Delhivery Surface',
    createdAt: new Date('2026-10-17T14:00:00Z'),
  });

  await SellerOrderModel.create({
    _id: 'subord-lumina-1',
    parentOrderId: 'ord-1002',
    sellerId: 'seller-prof-2',
    shopId: 'shop-2',
    shopName: 'Lumina Living Studio',
    subtotalPaise: 249900,
    shippingPaise: 0,
    taxPaise: 44982,
    discountPaise: 0,
    totalPaise: 294882,
    commissionTotalPaise: 29988,
    sellerNetPayablePaise: 219912,
    status: 'DELIVERED',
    shippingCarrier: 'Delhivery Surface',
    trackingNumber: 'DELHIVERY-9948201',
    shippedAt: new Date('2026-10-17T18:00:00Z'),
    deliveredAt: new Date('2026-10-19T11:00:00Z'),
    createdAt: new Date('2026-10-17T14:00:00Z'),
  });

  await OrderItemModel.create({
    _id: 'item-2-1',
    sellerOrderId: 'subord-lumina-1',
    orderId: 'ord-1002',
    productId: 'prod-3',
    variantId: 'var-3-1',
    productName: 'Handcrafted Terracotta Ceramic Pour-Over Carafe Set',
    sku: 'LUM-CER-SND',
    variantName: 'Sandstone Grey (500ml)',
    unitPricePaise: 249900,
    quantity: 1,
    totalPaise: 249900,
    allocatedDiscountPaise: 0,
    taxPaise: 44982,
    commissionRate: 0.12,
    commissionAmountPaise: 29988,
    sellerPayablePaise: 219912,
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800',
    createdAt: new Date('2026-10-17T14:00:00Z'),
  });

  const postings1002 = createOrderLedgerPostings({
    orderId: 'ord-1002',
    sellerId: 'seller-prof-2',
    grossPaise: 294882,
    sellerPayablePaise: 219912,
    commissionPaise: 29988,
    taxPaise: 44982,
    shippingPaise: 0,
  });

  for (const p of postings1002) {
    await LedgerEntryModel.create({
      transactionId: 'tx_ord1002_seed',
      sellerId: p.sellerId,
      orderId: p.orderId,
      type: p.type,
      debitPaise: p.debitPaise,
      creditPaise: p.creditPaise,
      description: p.description,
      createdAt: new Date('2026-10-17T14:00:00Z'),
    });
  }

  // 9. Reviews
  await ReviewModel.create([
    {
      _id: 'rev-1',
      productId: 'prod-1',
      userId: 'user-customer-1',
      userName: 'Sarah Connor',
      rating: 5,
      title: 'Phenomenal Noise Cancellation on Bengaluru Metro',
      comment:
        'Commuting on the Namma Metro used to be painful with the noise. These headphones create total silence! Battery lasts easily the whole week.',
      verifiedPurchase: true,
      sellerReply: {
        comment: 'Thank you Sarah! So glad you love the ANC on your commute. Reach out anytime for assistance.',
        repliedAt: new Date('2026-10-19T15:00:00Z'),
      },
      createdAt: new Date('2026-10-19T12:00:00Z'),
    },
    {
      _id: 'rev-2',
      productId: 'prod-3',
      userId: 'user-customer-2',
      userName: 'Priya Sharma',
      rating: 5,
      title: 'Exquisite Terracotta Craftsmanship',
      comment:
        'The finish and thermal retention of this carafe are unmatched. A centerpiece for our morning coffee ritual.',
      verifiedPurchase: true,
      createdAt: new Date('2026-10-19T14:00:00Z'),
    },
  ]);

  // 10. Audit Logs
  await AuditLogModel.create({
    _id: 'audit-seed-init',
    actorId: 'user-admin-1',
    actorRole: 'ADMIN',
    action: 'INITIALIZE_MARKETPLACE_SEED',
    targetType: 'SYSTEM',
    targetId: 'marketsphere_system',
    details: {
      seedVersion: '2.0.0-mongodb',
      currency: 'INR',
      gstRatePercent: GST_RATE_PERCENT,
      recordsSeeded: true,
    },
    timestamp: now,
  });

  console.log('[DB] Marketplace successfully seeded in Indian INR (Paise minor units).');
}
