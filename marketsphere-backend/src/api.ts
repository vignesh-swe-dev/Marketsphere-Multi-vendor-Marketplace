/**
 * REST API Router for MarketSphere (/api/v1)
 * Backed by MongoDB Atlas via Mongoose models and multi-document transactions.
 * Full business logic, validation, multi-seller split, ledger posting, and role enforcement.
 * All monetary amounts are handled in integer minor units (paise).
 */

import { makeAsyncSafe } from './lib/asyncRoutes.ts';
import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
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
import { withTransaction } from './db.ts';
import {
  resolveCommissionRate,
  allocateDiscounts,
  calculateItemCommission,
  type CommissionContext,
} from './lib/commission.ts';
import { PaymentGatewayService } from './payments.ts';
import { CartError, mergeCartItems, resolveCartLine } from './lib/cart.ts';
import { calculateSellerBalance } from './lib/ledger.ts';
import type { LedgerEntry } from './types/index.ts';
import { CURRENCY, GST_RATE_PERCENT, FLAT_SHIPPING_PAISE, FREE_SHIPPING_THRESHOLD_PAISE } from './config.ts';
import {
  authRouter,
  requireAuth,
  requireRole,
  requireApprovedSeller,
  optionalAuth,
  sendError,
} from './auth.ts';
import { newsletterRouter } from './newsletter.ts';

export const apiRouter = makeAsyncSafe(Router());

// Mount real auth router at /auth
apiRouter.use('/auth', authRouter);

// Mount newsletter router at /newsletter
apiRouter.use('/newsletter', newsletterRouter);

// Apply optionalAuth globally so req.auth is populated where possible
apiRouter.use(optionalAuth);

// ----------------------------------------------------
// Health Check (public)
// ----------------------------------------------------
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'MarketSphere API',
    version: '2.0.0-mongodb',
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// Categories (public)
// ----------------------------------------------------
apiRouter.get('/categories', async (_req, res) => {
  const categories = await CategoryModel.find().sort({ name: 1 });
  res.json({ categories });
});

// ----------------------------------------------------
// Products Catalog
// Public: GET /products with status=PUBLISHED (default)
// Auth required: any other status filter (ALL, DRAFT, etc.)
// SELLER: own products only when not PUBLISHED; ADMIN: all
// ----------------------------------------------------
apiRouter.get('/products', async (req, res) => {
  // Query values must be plain strings. Arrays or objects (?status[$ne]=x) are ignored.
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const category = str(req.query.category);
  const search = str(req.query.search);
  const seller = str(req.query.seller);
  const minPrice = str(req.query.minPrice);
  const maxPrice = str(req.query.maxPrice);
  const sort = str(req.query.sort) || 'newest';
  const status = str(req.query.status) || 'PUBLISHED';

  // Only PUBLISHED products are public. Everything else (DRAFT, PENDING_REVIEW, ALL ...) is for staff and sellers.
  if (status !== 'PUBLISHED') {
    if (!req.auth) {
      return sendError(res, 401, 'AUTH_REQUIRED', 'Authentication is required to view non-published products');
    }
    if (!['ADMIN', 'SUPPORT', 'SELLER'].includes(req.auth.role)) {
      return sendError(res, 403, 'FORBIDDEN', 'You do not have access to unpublished products');
    }
  }

  const filter: Record<string, any> = {};

  if (status !== 'ALL') {
    filter.status = status;
  }

  // Non-admin sellers can only see their own products
  if (status !== 'PUBLISHED' && req.auth?.role === 'SELLER') {
    if (!req.auth.sellerProfileId) {
      return res.json({ products: [] });
    }
    filter.sellerId = req.auth.sellerProfileId;
  }

  if (category) {
    const cat = await CategoryModel.findOne({
      $or: [{ slug: category }, { _id: category }],
    } as any);
    if (cat) {
      filter.categoryId = cat._id;
    } else {
      filter.categoryId = category;
    }
  }

  if (seller && req.auth?.role === 'ADMIN') {
    const shop = await ShopModel.findOne({
      $or: [{ slug: seller }, { sellerId: seller }],
    } as any);
    filter.sellerId = shop ? (shop as any).sellerId : seller;
  } else if (seller && req.auth?.role === 'SELLER') {
    filter.sellerId = req.auth.sellerProfileId;
  }

  if (search) {
    // Escape regex characters so a search like "(a+)+$" cannot be used to slow the database down
    const term = search.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } },
      { brand: { $regex: term, $options: 'i' } },
      { tags: { $in: [new RegExp(term, 'i')] } },
    ];
  }

  if (minPrice || maxPrice) {
    filter.basePricePaise = {};
    if (minPrice) filter.basePricePaise.$gte = Number(minPrice);
    if (maxPrice) filter.basePricePaise.$lte = Number(maxPrice);
  }

  const sortOptions: Record<string, 1 | -1> = {};
  if (sort === 'price_asc') sortOptions.basePricePaise = 1;
  else if (sort === 'price_desc') sortOptions.basePricePaise = -1;
  else if (sort === 'rating') sortOptions.rating = -1;
  else sortOptions.createdAt = -1;

  const rawProducts = await ProductModel.find(filter).sort(sortOptions);

  // Hydrate shop and category details
  const products = await Promise.all(
    rawProducts.map(async (p) => {
      const [shop, cat, variants] = await Promise.all([
        ShopModel.findById(p.shopId),
        CategoryModel.findById(p.categoryId),
        ProductVariantModel.find({ productId: p.id }),
      ]);

      const mappedVariants = variants.map((v) => ({
        ...v.toJSON(),
        productId: v.productId,
        pricePaise: v.pricePaise,
        priceCents: v.pricePaise, // backward compatibility
        compareAtPricePaise: v.compareAtPricePaise,
        compareAtPriceCents: v.compareAtPricePaise,
        inventoryQuantity: v.inventoryQuantity,
        attributes: v.attributes instanceof Map ? Object.fromEntries(v.attributes) : (v.attributes || {}),
      }));

      const inventoryTotal = mappedVariants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);

      return {
        ...p.toJSON(),
        basePricePaise: p.basePricePaise,
        basePriceCents: p.basePricePaise, // backward compatibility
        shopName: shop ? shop.name : undefined,
        shopSlug: shop ? shop.slug : undefined,
        categoryName: cat ? cat.name : undefined,
        shippingPolicy: shop ? shop.shippingPolicy : undefined,
        refundPolicy: shop ? shop.refundPolicy : undefined,
        variants: mappedVariants,
        inventoryTotal,
      };
    })
  );

  res.json({ products });
});

apiRouter.get('/products/:id', async (req, res) => {
  const { id } = req.params;
  const product = await ProductModel.findOne({
    $or: [{ _id: id }, { slug: id }],
  });

  if (!product) return sendError(res, 404, 'NOT_FOUND', 'Product not found');

  // Non-published products: owner seller or admin only
  if (product.status !== 'PUBLISHED') {
    if (!req.auth) {
      return sendError(res, 404, 'NOT_FOUND', 'Product not found');
    }
    const isOwnerSeller = req.auth.role === 'SELLER' && req.auth.sellerProfileId === product.sellerId;
    const isAdmin = req.auth.role === 'ADMIN';
    if (!isOwnerSeller && !isAdmin) {
      return sendError(res, 404, 'NOT_FOUND', 'Product not found');
    }
  }

  const [shop, cat, variants, reviews] = await Promise.all([
    ShopModel.findById(product.shopId),
    CategoryModel.findById(product.categoryId),
    ProductVariantModel.find({ productId: product.id }),
    ReviewModel.find({ productId: product.id }).sort({ createdAt: -1 }),
  ]);

  const mappedVariants = variants.map((v) => ({
    ...v.toJSON(),
    productId: v.productId,
    pricePaise: v.pricePaise,
    priceCents: v.pricePaise,
    compareAtPricePaise: v.compareAtPricePaise,
    compareAtPriceCents: v.compareAtPricePaise,
    inventoryQuantity: v.inventoryQuantity,
    attributes: v.attributes instanceof Map ? Object.fromEntries(v.attributes) : (v.attributes || {}),
  }));

  const inventoryTotal = mappedVariants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);

  res.json({
    product: {
      ...product.toJSON(),
      basePricePaise: product.basePricePaise,
      basePriceCents: product.basePricePaise,
      shopName: shop ? shop.name : undefined,
      shopSlug: shop ? shop.slug : undefined,
      categoryName: cat ? cat.name : undefined,
      shippingPolicy: shop ? shop.shippingPolicy : undefined,
      refundPolicy: shop ? shop.refundPolicy : undefined,
      inventoryTotal,
      variants: mappedVariants,
      reviews: reviews.map((r) => ({
        ...r.toJSON(),
        userId: r.userId,
        userName: r.userName,
        verifiedPurchase: r.verifiedPurchase,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  });
});

// ----------------------------------------------------
// Shops & Sellers (public)
// ----------------------------------------------------
apiRouter.get('/shops/:slug', async (req, res) => {
  const { slug } = req.params;
  const shop = await ShopModel.findOne({
    $or: [{ slug }, { _id: slug }],
  });

  if (!shop) return sendError(res, 404, 'NOT_FOUND', 'Shop not found');

  const [sellerProfile, products] = await Promise.all([
    SellerProfileModel.findById(shop.sellerId),
    ProductModel.find({ shopId: shop.id, status: 'PUBLISHED' }).sort({ createdAt: -1 }),
  ]);

  const owner = sellerProfile ? await UserModel.findById(sellerProfile.userId) : null;

  res.json({
    shop: {
      ...shop.toJSON(),
      businessName: sellerProfile ? sellerProfile.businessName : undefined,
      sellerStatus: sellerProfile ? sellerProfile.status : undefined,
      ownerName: owner ? owner.fullName : undefined,
    },
    products: products.map((p) => ({
      ...p.toJSON(),
      basePricePaise: p.basePricePaise,
      basePriceCents: p.basePricePaise,
    })),
  });
});

// ----------------------------------------------------
// Seller Applications (CUSTOMER only, identity from token)
// ----------------------------------------------------
apiRouter.post('/seller/applications', requireRole('CUSTOMER'), async (req, res) => {
  const userId = req.auth!.userId;
  const { businessName, businessRegNumber, taxId, contactEmail, contactPhone, bankDetails } = req.body;
  const gstin = ((req.body.gstin || businessRegNumber || '') as string).trim().toUpperCase();
  const pan = ((req.body.pan || taxId || '') as string).trim().toUpperCase();
  const ifsc = ((req.body.ifsc || (bankDetails && bankDetails.routingOrIfsc) || '') as string).trim().toUpperCase();
  const phone = ((contactPhone || req.body.phone || '') as string).trim();

  if (!businessName || !contactEmail) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Business Name and Contact Email are required');
  }

  // Validate Indian KYC formats
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return sendError(res, 400, 'INVALID_GSTIN', 'Invalid GSTIN format (e.g. 29ABCDE1234F1Z5)');
  }
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    return sendError(res, 400, 'INVALID_PAN', 'Invalid PAN format (e.g. ABCDE1234F)');
  }
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return sendError(res, 400, 'INVALID_IFSC', 'Invalid IFSC format (e.g. HDFC0001234)');
  }
  if (phone) {
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!/^(?:\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
      return sendError(res, 400, 'INVALID_PHONE', 'Invalid mobile number (expected 10-digit Indian mobile number)');
    }
  }

  const existing = await SellerProfileModel.findOne({ userId });
  if (existing) {
    return sendError(res, 409, 'ALREADY_APPLIED', 'You already have an existing seller profile or application');
  }

  const profileId = `seller-prof-${crypto.randomUUID()}`;
  const now = new Date();

  const bankObj = bankDetails || {};
  if (ifsc && !bankObj.routingOrIfsc) {
    bankObj.routingOrIfsc = ifsc;
  }

  await SellerProfileModel.create({
    _id: profileId,
    userId,
    businessName,
    businessRegistrationNumber: gstin || undefined,
    taxId: pan || undefined,
    gstin: gstin || undefined,
    pan: pan || undefined,
    ifsc: ifsc || undefined,
    contactEmail: contactEmail.toLowerCase().trim(),
    contactPhone: phone || '',
    status: 'PENDING',
    bankDetails: bankObj,
    appliedAt: now,
  });

  await AuditLogModel.create({
    _id: `audit_${crypto.randomUUID()}`,
    actorId: userId,
    actorRole: 'CUSTOMER',
    action: 'SUBMIT_SELLER_APPLICATION',
    targetType: 'SELLER_PROFILE',
    targetId: profileId,
    details: { businessName, contactEmail },
    timestamp: now,
  });

  res.status(201).json({
    success: true,
    message: 'Seller application submitted for administrator review',
    sellerProfileId: profileId,
  });
});

// ----------------------------------------------------
// Cart & Checkout Quote Engine (public)
// ----------------------------------------------------
apiRouter.post('/checkout/quote', async (req, res) => {
  const { items, couponCode } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return sendError(res, 400, 'EMPTY_CART', 'Cart items are required');
  }

  const defaultRule = await CommissionRuleModel.findOne({ scope: 'DEFAULT' });
  const catRules = await CommissionRuleModel.find({ scope: 'CATEGORY' });
  const sellerRules = await CommissionRuleModel.find({ scope: 'SELLER' });

  const commissionContext: CommissionContext = {
    marketplaceDefaultRate: (defaultRule?.percentageRate || 10.0) / 100,
    categoryRates: Object.fromEntries(catRules.map((r) => [r.targetId!, r.percentageRate / 100])),
    sellerRates: Object.fromEntries(sellerRules.map((r) => [r.targetId!, r.percentageRate / 100])),
  };

  const sellerGroups: Record<
    string,
    {
      sellerId: string;
      shopId: string;
      shopName: string;
      items: any[];
      subtotalPaise: number;
    }
  > = {};

  let totalGrossPaise = 0;
  const validatedLineItems: any[] = [];

  let cartItems;
  try {
    cartItems = mergeCartItems(items);
  } catch (err) {
    if (err instanceof CartError) return sendError(res, err.status, err.code, err.message);
    throw err;
  }

  for (const item of cartItems) {
    const product = await ProductModel.findById(item.productId);
    if (!product) return sendError(res, 400, 'INVALID_PRODUCT', `Product ${item.productId} not found`);

    const shop = await ShopModel.findById(product.shopId);
    let resolved;
    try {
      resolved = await resolveCartLine(product, item);
    } catch (err) {
      if (err instanceof CartError) return sendError(res, err.status, err.code, err.message);
      throw err;
    }
    const { quantity, variantName, sku, unitPricePaise: unitPrice } = resolved;
    const lineGross = unitPrice * quantity;
    totalGrossPaise += lineGross;

    const line = {
      productId: product.id,
      variantId: resolved.variantId,
      productName: product.name,
      variantName,
      sku,
      unitPricePaise: unitPrice,
      unitPriceCents: unitPrice,
      quantity,
      lineGrossPaise: lineGross,
      sellerId: product.sellerId,
      shopId: product.shopId,
      shopName: shop ? shop.name : 'Verified Seller',
      categoryId: product.categoryId,
      imageUrl: product.images[0] || '',
    };
    validatedLineItems.push(line);

    if (!sellerGroups[product.sellerId]) {
      sellerGroups[product.sellerId] = {
        sellerId: product.sellerId,
        shopId: product.shopId,
        shopName: shop ? shop.name : 'Verified Seller',
        items: [],
        subtotalPaise: 0,
      };
    }
    sellerGroups[product.sellerId].items.push(line);
    sellerGroups[product.sellerId].subtotalPaise += lineGross;
  }

  let totalDiscountPaise = 0;
  let appliedCoupon: any = null;

  if (couponCode) {
    const coupon = await CouponModel.findOne({ code: String(couponCode).toUpperCase() });
    if (coupon) {
      const now = new Date();
      if (
        now <= coupon.expiresAt &&
        coupon.timesUsed < coupon.usageLimit &&
        totalGrossPaise >= coupon.minOrderValuePaise
      ) {
        if (coupon.discountType === 'PERCENTAGE') {
          totalDiscountPaise = Math.round((totalGrossPaise * coupon.discountValue) / 100);
          if (coupon.maxDiscountPaise) {
            totalDiscountPaise = Math.min(totalDiscountPaise, coupon.maxDiscountPaise);
          }
        } else {
          totalDiscountPaise = Math.min(coupon.discountValue, totalGrossPaise);
        }
        appliedCoupon = coupon;
      }
    }
  }

  const discountAllocations = allocateDiscounts(
    validatedLineItems.map((it, idx) => ({ id: `line_${idx}`, grossPaise: it.lineGrossPaise })),
    totalDiscountPaise
  );

  const sellerSubordersQuote: any[] = [];
  let totalShippingPaise = 0;
  let totalTaxPaise = 0;

  for (const [sellerId, group] of Object.entries(sellerGroups)) {
    const sellerShippingPaise =
      group.subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : FLAT_SHIPPING_PAISE;
    totalShippingPaise += sellerShippingPaise;

    let sellerGross = 0;
    let sellerDiscount = 0;
    let sellerCommissionTotal = 0;
    let sellerNetPayable = 0;
    const computedItems: any[] = [];

    group.items.forEach((item) => {
      const lineKey = `line_${validatedLineItems.indexOf(item)}`;
      const allocatedDiscount = discountAllocations[lineKey] || 0;
      const rate = resolveCommissionRate(commissionContext, sellerId, item.categoryId);

      const commCalc = calculateItemCommission(
        {
          productId: item.productId,
          sellerId,
          categoryId: item.categoryId,
          unitPricePaise: item.unitPricePaise,
          quantity: item.quantity,
        },
        allocatedDiscount,
        rate
      );

      sellerGross += commCalc.grossMerchandisePaise;
      sellerDiscount += commCalc.allocatedDiscountPaise;
      sellerCommissionTotal += commCalc.commissionAmountPaise;
      sellerNetPayable += commCalc.sellerPayablePaise;

      computedItems.push({
        ...item,
        allocatedDiscountPaise: commCalc.allocatedDiscountPaise,
        allocatedDiscountCents: commCalc.allocatedDiscountPaise,
        commissionRate: rate,
        commissionAmountPaise: commCalc.commissionAmountPaise,
        commissionAmountCents: commCalc.commissionAmountPaise,
        sellerPayablePaise: commCalc.sellerPayablePaise,
        sellerPayableCents: commCalc.sellerPayablePaise,
      });
    });

    const taxableAmount = Math.max(0, sellerGross - sellerDiscount);
    const sellerTaxPaise = Math.round(taxableAmount * (GST_RATE_PERCENT / 100));
    totalTaxPaise += sellerTaxPaise;

    const sellerTotal = sellerGross - sellerDiscount + sellerShippingPaise + sellerTaxPaise;

    sellerSubordersQuote.push({
      sellerId,
      shopId: group.shopId,
      shopName: group.shopName,
      subtotalPaise: sellerGross,
      subtotalCents: sellerGross,
      discountPaise: sellerDiscount,
      discountCents: sellerDiscount,
      shippingPaise: sellerShippingPaise,
      shippingCents: sellerShippingPaise,
      taxPaise: sellerTaxPaise,
      taxCents: sellerTaxPaise,
      totalPaise: sellerTotal,
      totalCents: sellerTotal,
      commissionTotalPaise: sellerCommissionTotal,
      commissionTotalCents: sellerCommissionTotal,
      sellerNetPayablePaise: sellerNetPayable + sellerShippingPaise,
      sellerNetPayableCents: sellerNetPayable + sellerShippingPaise,
      items: computedItems,
    });
  }

  const grandTotalPaise = totalGrossPaise - totalDiscountPaise + totalShippingPaise + totalTaxPaise;

  res.json({
    quote: {
      subtotalPaise: totalGrossPaise,
      subtotalCents: totalGrossPaise,
      discountPaise: totalDiscountPaise,
      discountCents: totalDiscountPaise,
      shippingPaise: totalShippingPaise,
      shippingCents: totalShippingPaise,
      taxPaise: totalTaxPaise,
      taxCents: totalTaxPaise,
      totalPaise: grandTotalPaise,
      totalCents: grandTotalPaise,
      currency: CURRENCY,
      taxLabel: `GST (${GST_RATE_PERCENT}%)`,
      couponApplied: appliedCoupon ? appliedCoupon.code : null,
      sellerOrders: sellerSubordersQuote,
    },
  });
});

// ----------------------------------------------------
// Order Creation & Payment Initiation (requireAuth, withTransaction)
// ----------------------------------------------------
apiRouter.post('/checkout/order', requireAuth, async (req, res) => {
  const customerId = req.auth!.userId;
  const { shippingAddress, items, couponCode, paymentMethod = 'CARD' } = req.body;

  if (!shippingAddress || !items || !Array.isArray(items) || items.length === 0) {
    return sendError(res, 400, 'INVALID_PAYLOAD', 'Shipping address and items are required');
  }

  // Validate Indian address requirements: 6-digit PIN code and mobile number
  const pinCode = shippingAddress.postalCode || shippingAddress.pinCode;
  if (!pinCode || !/^[1-9][0-9]{5}$/.test(String(pinCode).trim())) {
    return sendError(res, 400, 'INVALID_PIN_CODE', 'A valid 6-digit Indian PIN code is required');
  }
  const mobile = shippingAddress.phone || shippingAddress.mobile;
  if (mobile) {
    const cleanMobile = String(mobile).replace(/[\s-]/g, '');
    if (!/^(?:\+91)?[6-9]\d{9}$/.test(cleanMobile)) {
      return sendError(res, 400, 'INVALID_MOBILE', 'A valid 10-digit Indian mobile number is required');
    }
  }

  const customer = await UserModel.findById(customerId);
  if (!customer) return sendError(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer account not found');

  const orderId = `ord_${crypto.randomUUID()}`;
  const orderNumber = `MS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    const createdOrder = await withTransaction(async (session) => {
      const defaultRule = await CommissionRuleModel.findOne({ scope: 'DEFAULT' }).session(session);
      const catRules = await CommissionRuleModel.find({ scope: 'CATEGORY' }).session(session);
      const sellerRules = await CommissionRuleModel.find({ scope: 'SELLER' }).session(session);

      const commissionContext: CommissionContext = {
        marketplaceDefaultRate: (defaultRule?.percentageRate || 10.0) / 100,
        categoryRates: Object.fromEntries(catRules.map((r) => [r.targetId!, r.percentageRate / 100])),
        sellerRates: Object.fromEntries(sellerRules.map((r) => [r.targetId!, r.percentageRate / 100])),
      };

      const sellerGroups: Record<string, any> = {};
      let totalGrossPaise = 0;
      const validatedLines: any[] = [];

      for (const item of mergeCartItems(items)) {
        const product = await ProductModel.findById(item.productId).session(session);
        if (!product) throw new Error(`Product ${item.productId} not found`);

        const shop = await ShopModel.findById(product.shopId).session(session);
        const resolved = await resolveCartLine(product, item, session);
        const { quantity, variantName, sku, unitPricePaise: unitPrice } = resolved;
        const lineGross = unitPrice * quantity;
        totalGrossPaise += lineGross;

        const line = {
          productId: product.id,
          variantId: resolved.variantId,
          productName: product.name,
          variantName,
          sku,
          unitPricePaise: unitPrice,
          quantity,
          lineGrossPaise: lineGross,
          sellerId: product.sellerId,
          shopId: product.shopId,
          shopName: shop ? shop.name : 'Verified Seller',
          categoryId: product.categoryId,
          imageUrl: product.images[0] || '',
        };
        validatedLines.push(line);

        if (!sellerGroups[product.sellerId]) {
          sellerGroups[product.sellerId] = {
            sellerId: product.sellerId,
            shopId: product.shopId,
            shopName: shop ? shop.name : 'Verified Seller',
            items: [],
            subtotalPaise: 0,
          };
        }
        sellerGroups[product.sellerId].items.push(line);
        sellerGroups[product.sellerId].subtotalPaise += lineGross;
      }

      let totalDiscountPaise = 0;
      if (couponCode) {
        const coupon = await CouponModel.findOne({ code: String(couponCode).toUpperCase() }).session(session);
        if (coupon && coupon.timesUsed < coupon.usageLimit && totalGrossPaise >= coupon.minOrderValuePaise) {
          if (coupon.discountType === 'PERCENTAGE') {
            totalDiscountPaise = Math.round((totalGrossPaise * coupon.discountValue) / 100);
            if (coupon.maxDiscountPaise) {
              totalDiscountPaise = Math.min(totalDiscountPaise, coupon.maxDiscountPaise);
            }
          } else {
            totalDiscountPaise = Math.min(coupon.discountValue, totalGrossPaise);
          }
          coupon.timesUsed += 1;
          await coupon.save({ session });
        }
      }

      const discountAllocations = allocateDiscounts(
        validatedLines.map((it, idx) => ({ id: `line_${idx}`, grossPaise: it.lineGrossPaise })),
        totalDiscountPaise
      );

      let grandShippingPaise = 0;
      let grandTaxPaise = 0;
      const sellerSubordersToInsert: any[] = [];

      for (const [sellerId, group] of Object.entries(sellerGroups)) {
        const sShipping =
          group.subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : FLAT_SHIPPING_PAISE;
        grandShippingPaise += sShipping;

        let sGross = 0;
        let sDiscount = 0;
        let sCommTotal = 0;
        let sSellerPayable = 0;
        const itemsWithMath: any[] = [];

        group.items.forEach((item: any) => {
          const lineKey = `line_${validatedLines.indexOf(item)}`;
          const allocatedDiscount = discountAllocations[lineKey] || 0;
          const rate = resolveCommissionRate(commissionContext, sellerId, item.categoryId);

          const commCalc = calculateItemCommission(
            {
              productId: item.productId,
              sellerId,
              categoryId: item.categoryId,
              unitPricePaise: item.unitPricePaise,
              quantity: item.quantity,
            },
            allocatedDiscount,
            rate
          );

          sGross += commCalc.grossMerchandisePaise;
          sDiscount += commCalc.allocatedDiscountPaise;
          sCommTotal += commCalc.commissionAmountPaise;
          sSellerPayable += commCalc.sellerPayablePaise;

          itemsWithMath.push({
            ...item,
            allocatedDiscountPaise: commCalc.allocatedDiscountPaise,
            taxPaise: Math.round(
              Math.max(0, commCalc.grossMerchandisePaise - commCalc.allocatedDiscountPaise) *
                (GST_RATE_PERCENT / 100)
            ),
            commissionRate: rate,
            commissionAmountPaise: commCalc.commissionAmountPaise,
            sellerPayablePaise: commCalc.sellerPayablePaise,
          });
        });

        const taxableAmount = Math.max(0, sGross - sDiscount);
        const sTax = Math.round(taxableAmount * (GST_RATE_PERCENT / 100));
        grandTaxPaise += sTax;
        const sTotal = sGross - sDiscount + sShipping + sTax;

        sellerSubordersToInsert.push({
          id: `subord_${crypto.randomUUID()}`,
          sellerId,
          shopId: group.shopId,
          shopName: group.shopName,
          subtotalPaise: sGross,
          shippingPaise: sShipping,
          taxPaise: sTax,
          discountPaise: sDiscount,
          totalPaise: sTotal,
          commissionTotalPaise: sCommTotal,
          sellerNetPayablePaise: sSellerPayable + sShipping,
          items: itemsWithMath,
        });
      }

      const grandTotalPaise = totalGrossPaise - totalDiscountPaise + grandShippingPaise + grandTaxPaise;

      await OrderModel.create(
        [
          {
            _id: orderId,
            orderNumber,
            customerId: customer.id,
            customerName: customer.fullName,
            customerEmail: customer.email,
            status: 'PENDING_PAYMENT',
            subtotalPaise: totalGrossPaise,
            shippingPaise: grandShippingPaise,
            taxPaise: grandTaxPaise,
            discountPaise: totalDiscountPaise,
            totalPaise: grandTotalPaise,
            currency: CURRENCY,
            shippingAddress,
            paymentMethod,
          },
        ],
        { session }
      );

      for (const so of sellerSubordersToInsert) {
        await SellerOrderModel.create(
          [
            {
              _id: so.id,
              parentOrderId: orderId,
              sellerId: so.sellerId,
              shopId: so.shopId,
              shopName: so.shopName,
              subtotalPaise: so.subtotalPaise,
              shippingPaise: so.shippingPaise,
              taxPaise: so.taxPaise,
              discountPaise: so.discountPaise,
              totalPaise: so.totalPaise,
              commissionTotalPaise: so.commissionTotalPaise,
              sellerNetPayablePaise: so.sellerNetPayablePaise,
              status: 'PENDING_PAYMENT',
            },
          ],
          { session }
        );

        for (const item of so.items) {
          await OrderItemModel.create(
            [
              {
                _id: `item_${crypto.randomUUID()}`,
                sellerOrderId: so.id,
                orderId,
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                sku: item.sku,
                variantName: item.variantName || undefined,
                unitPricePaise: item.unitPricePaise,
                quantity: item.quantity,
                totalPaise: item.lineGrossPaise,
                allocatedDiscountPaise: item.allocatedDiscountPaise,
                taxPaise: item.taxPaise,
                commissionRate: item.commissionRate,
                commissionAmountPaise: item.commissionAmountPaise,
                sellerPayablePaise: item.sellerPayablePaise,
                imageUrl: item.imageUrl,
              },
            ],
            { session }
          );
        }
      }

      return {
        id: orderId,
        orderNumber,
        totalPaise: grandTotalPaise,
        totalCents: grandTotalPaise,
        status: 'PENDING_PAYMENT',
      };
    });

    const idempotencyKey = `idem_${orderId}`;
    const paymentSession = await PaymentGatewayService.createPaymentSession({
      orderId,
      amountPaise: createdOrder.totalPaise,
      currency: CURRENCY,
      idempotencyKey,
    });

    res.status(201).json({
      order: {
        ...createdOrder,
        paymentSession,
      },
    });
  } catch (err: any) {
    if (err instanceof CartError) {
      return sendError(res, err.status, err.code, err.message);
    }
    if (err.message?.includes('Insufficient stock')) {
      return sendError(res, 400, 'INSUFFICIENT_INVENTORY', err.message);
    }
    return sendError(res, 500, 'ORDER_CREATION_FAILED', err.message);
  }
});

// ----------------------------------------------------
// Payment Verification & Capture (requireAuth, order ownership)
// ----------------------------------------------------
apiRouter.post('/payments/verify-and-capture', requireAuth, async (req, res) => {
  // The built-in payment provider is a SANDBOX: the browser itself says "payment succeeded".
  // On a live server that would let anyone mark their own order as paid, so it is switched off
  // unless the owner explicitly accepts that (ALLOW_SANDBOX_PAYMENTS=true) or connects a real gateway.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SANDBOX_PAYMENTS !== 'true') {
    return sendError(
      res,
      503,
      'PAYMENTS_NOT_CONFIGURED',
      'Online payments are not set up yet. Connect a real payment gateway before accepting orders.'
    );
  }
  const { orderId, providerPaymentId, simulatedSuccess = true } = req.body;
  if (!orderId || !providerPaymentId) {
    return sendError(res, 400, 'MISSING_PARAMS', 'orderId and providerPaymentId are required');
  }

  // Verify order belongs to caller (or caller is ADMIN)
  const ord = await OrderModel.findById(orderId);
  if (!ord) return sendError(res, 404, 'NOT_FOUND', 'Order not found');
  if (req.auth!.role !== 'ADMIN' && ord.customerId !== req.auth!.userId) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have access to this order');
  }

  try {
    if (!simulatedSuccess) {
      await PaymentModel.updateOne({ providerPaymentId }, { $set: { status: 'FAILED' } });
      ord.status = 'CANCELLED';
      await ord.save();
      return res.json({ success: false, message: 'Payment authorization declined by card network' });
    }

    const result = await PaymentGatewayService.handlePaymentSuccess(providerPaymentId, orderId);
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('Insufficient stock')) {
      return sendError(res, 409, 'OUT_OF_STOCK', err.message);
    }
    return sendError(res, 500, 'PAYMENT_CAPTURE_ERROR', err.message);
  }
});

// ----------------------------------------------------
// Signed Payment Webhook (HMAC-authenticated, public)
// ----------------------------------------------------
apiRouter.post('/webhooks/payments/sandbox', async (req, res) => {
  const signature = req.headers['x-marketsphere-signature'] as string;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  if (!signature || !PaymentGatewayService.verifySignature(rawBody, signature)) {
    return sendError(res, 401, 'INVALID_WEBHOOK_SIGNATURE', 'HMAC signature verification failed');
  }

  const { eventType, providerPaymentId, orderId } = req.body;

  if (eventType === 'payment.succeeded') {
    const result = await PaymentGatewayService.handlePaymentSuccess(providerPaymentId, orderId);
    return res.json(result);
  }

  res.json({ received: true });
});

// ----------------------------------------------------
// Customer / General Orders API (requireAuth)
// ----------------------------------------------------
async function formatOrderResponse(ord: any) {
  const sellerOrders = await SellerOrderModel.find({ parentOrderId: ord.id });
  const sellerOrdersWithItems = await Promise.all(
    sellerOrders.map(async (so) => {
      const items = await OrderItemModel.find({ sellerOrderId: so.id });
      return {
        ...so.toJSON(),
        parentOrderId: so.parentOrderId,
        sellerId: so.sellerId,
        shopId: so.shopId,
        shopName: so.shopName,
        subtotalPaise: so.subtotalPaise,
        subtotalCents: so.subtotalPaise,
        shippingPaise: so.shippingPaise,
        shippingCents: so.shippingPaise,
        taxPaise: so.taxPaise,
        taxCents: so.taxPaise,
        discountPaise: so.discountPaise,
        discountCents: so.discountPaise,
        totalPaise: so.totalPaise,
        totalCents: so.totalPaise,
        commissionTotalPaise: so.commissionTotalPaise,
        commissionTotalCents: so.commissionTotalPaise,
        sellerNetPayablePaise: so.sellerNetPayablePaise,
        sellerNetPayableCents: so.sellerNetPayablePaise,
        shippingCarrier: so.shippingCarrier,
        trackingNumber: so.trackingNumber,
        shippedAt: so.shippedAt ? so.shippedAt.toISOString() : undefined,
        deliveredAt: so.deliveredAt ? so.deliveredAt.toISOString() : undefined,
        items: items.map((it) => ({
          ...it.toJSON(),
          sellerOrderId: it.sellerOrderId,
          productId: it.productId,
          variantId: it.variantId,
          productName: it.productName,
          variantName: it.variantName,
          unitPricePaise: it.unitPricePaise,
          unitPriceCents: it.unitPricePaise,
          totalPaise: it.totalPaise,
          totalCents: it.totalPaise,
          allocatedDiscountPaise: it.allocatedDiscountPaise,
          allocatedDiscountCents: it.allocatedDiscountPaise,
          taxPaise: it.taxPaise,
          taxCents: it.taxPaise,
          commissionRate: it.commissionRate,
          commissionAmountPaise: it.commissionAmountPaise,
          commissionAmountCents: it.commissionAmountPaise,
          sellerPayablePaise: it.sellerPayablePaise,
          sellerPayableCents: it.sellerPayablePaise,
          imageUrl: it.imageUrl,
        })),
      };
    })
  );

  return {
    ...ord.toJSON(),
    orderNumber: ord.orderNumber,
    customerId: ord.customerId,
    customerName: ord.customerName,
    customerEmail: ord.customerEmail,
    subtotalPaise: ord.subtotalPaise,
    subtotalCents: ord.subtotalPaise,
    shippingPaise: ord.shippingPaise,
    shippingCents: ord.shippingPaise,
    taxPaise: ord.taxPaise,
    taxCents: ord.taxPaise,
    discountPaise: ord.discountPaise,
    discountCents: ord.discountPaise,
    totalPaise: ord.totalPaise,
    totalCents: ord.totalPaise,
    paymentMethod: ord.paymentMethod,
    paymentId: ord.paymentId,
    createdAt: ord.createdAt.toISOString(),
    updatedAt: ord.updatedAt.toISOString(),
    shippingAddress: ord.shippingAddress,
    sellerOrders: sellerOrdersWithItems,
  };
}

apiRouter.get('/orders', requireAuth, async (req, res) => {
  const filter = req.auth!.role === 'ADMIN' ? {} : { customerId: req.auth!.userId };
  const orders = await OrderModel.find(filter).sort({ createdAt: -1 });
  const formatted = await Promise.all(orders.map(formatOrderResponse));
  res.json({ orders: formatted });
});

apiRouter.get('/orders/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const ord = await OrderModel.findOne({
    $or: [{ _id: id }, { orderNumber: id }],
  });

  if (!ord) return sendError(res, 404, 'NOT_FOUND', 'Order not found');

  if (req.auth!.role !== 'ADMIN' && ord.customerId !== req.auth!.userId) {
    return sendError(res, 404, 'NOT_FOUND', 'Order not found');
  }

  const formatted = await formatOrderResponse(ord);
  res.json({ order: formatted });
});

// ----------------------------------------------------
// Customer Refund Request (owner only)
// ----------------------------------------------------
apiRouter.post('/orders/:id/refund-request', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'A reason for the refund request is required (at least 5 characters)');
  }

  const ord = await OrderModel.findOne({
    $or: [{ _id: id }, { orderNumber: id }],
  });
  if (!ord) return sendError(res, 404, 'NOT_FOUND', 'Order not found');

  if (ord.customerId !== req.auth!.userId) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have access to this order');
  }

  if (!['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'].includes(ord.status)) {
    return sendError(res, 400, 'INVALID_STATE', `A refund cannot be requested for an order that is ${ord.status}`);
  }

  const now = new Date();
  ord.status = 'REFUND_REQUESTED';
  await ord.save();

  await AuditLogModel.create({
    _id: `audit_${crypto.randomUUID()}`,
    actorId: req.auth!.userId,
    actorRole: 'CUSTOMER',
    action: 'REQUEST_REFUND',
    targetType: 'ORDER',
    targetId: ord.id,
    details: { reason: reason.trim() },
    timestamp: now,
  });

  res.json({ success: true, message: 'Your refund request has been submitted. Our team will review it.' });
});

// ----------------------------------------------------
// Seller Orders & Fulfillment (requireApprovedSeller)
// ----------------------------------------------------
apiRouter.get('/seller/orders', requireApprovedSeller, async (req, res) => {
  const sellerId = req.auth!.sellerProfileId!;
  const sellerOrders = await SellerOrderModel.find({ sellerId }).sort({ createdAt: -1 });

  const detailed = await Promise.all(
    sellerOrders.map(async (so) => {
      const [order, items] = await Promise.all([
        OrderModel.findById(so.parentOrderId),
        OrderItemModel.find({ sellerOrderId: so.id }),
      ]);

      return {
        ...so.toJSON(),
        orderNumber: order ? order.orderNumber : undefined,
        customerName: order ? order.customerName : undefined,
        customerEmail: order ? order.customerEmail : undefined,
        shippingAddress: order ? order.shippingAddress : undefined,
        orderCreatedAt: order ? order.createdAt.toISOString() : undefined,
        items,
      };
    })
  );

  res.json({ sellerOrders: detailed });
});

apiRouter.patch('/seller/orders/:id/fulfillment', requireApprovedSeller, async (req, res) => {
  const { id } = req.params;
  const sellerId = req.auth!.sellerProfileId!;
  const { shippingCarrier, trackingNumber, status = 'SHIPPED' } = req.body;

  const sOrder = await SellerOrderModel.findOne({ _id: id, sellerId });
  if (!sOrder) return sendError(res, 404, 'NOT_FOUND', 'Seller order not found');

  const now = new Date();
  const carrier = shippingCarrier !== undefined ? shippingCarrier : sOrder.shippingCarrier || 'Blue Dart Air Express';
  const tracking = trackingNumber !== undefined ? trackingNumber : sOrder.trackingNumber || `BLUDART-${Date.now().toString().slice(-8)}`;

  sOrder.shippingCarrier = carrier;
  sOrder.trackingNumber = tracking;
  sOrder.status = status;
  if (status === 'SHIPPED' || status === 'DELIVERED') {
    sOrder.shippedAt = sOrder.shippedAt || now;
  }
  if (status === 'DELIVERED') {
    sOrder.deliveredAt = sOrder.deliveredAt || now;
  }
  await sOrder.save();

  // Check parent order suborders status
  const allSubs = await SellerOrderModel.find({ parentOrderId: sOrder.parentOrderId });
  const allDelivered = allSubs.length > 0 && allSubs.every((s) => s.status === 'DELIVERED');
  const allShippedOrDelivered =
    allSubs.length > 0 && allSubs.every((s) => s.status === 'SHIPPED' || s.status === 'DELIVERED');

  const parentOrder = await OrderModel.findById(sOrder.parentOrderId);
  if (parentOrder) {
    if (allDelivered) {
      parentOrder.status = 'DELIVERED';
    } else if (allShippedOrDelivered) {
      parentOrder.status = 'SHIPPED';
    } else {
      parentOrder.status = 'PROCESSING';
    }
    await parentOrder.save();
  }

  await AuditLogModel.create({
    _id: `audit_${crypto.randomUUID()}`,
    actorId: req.auth!.userId,
    actorRole: 'SELLER',
    action: 'UPDATE_FULFILLMENT',
    targetType: 'SELLER_ORDER',
    targetId: id,
    details: { shippingCarrier: carrier, trackingNumber: tracking, status },
    timestamp: now,
  });

  res.json({ success: true, message: 'Fulfillment information updated successfully' });
});

// ----------------------------------------------------
// Seller Products Management (requireApprovedSeller)
// ----------------------------------------------------
apiRouter.post('/seller/products', requireApprovedSeller, async (req, res) => {
  const sellerId = req.auth!.sellerProfileId!;
  const shopId = req.auth!.shopId;

  if (!shopId) {
    return sendError(res, 400, 'NO_SHOP', 'Your seller account does not have an associated shop yet');
  }

  const { categoryId, name, description, basePricePaise, basePriceCents, sku, brand, images, variants } = req.body;
  const finalPrice = basePricePaise ?? basePriceCents;

  if (!categoryId || !name || !finalPrice || !sku) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'categoryId, name, basePricePaise, and sku are required');
  }

  if (!Number.isInteger(finalPrice) || finalPrice <= 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'basePricePaise must be a positive integer');
  }

  const cat = await CategoryModel.findById(categoryId);
  if (!cat) {
    return sendError(res, 400, 'INVALID_CATEGORY', 'The specified category does not exist');
  }

  // Every product gets at least one variant so stock is always tracked
  const variantInputs: any[] =
    Array.isArray(variants) && variants.length > 0
      ? variants
      : [{ name: 'Standard', pricePaise: finalPrice, inventoryQuantity: req.body.inventoryQuantity }];
  for (const v of variantInputs) {
    const price = v.pricePaise ?? v.priceCents ?? finalPrice;
    const qty = v.inventoryQuantity ?? 10;
    if (!Number.isInteger(price) || price <= 0 || !Number.isInteger(qty) || qty < 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Variant price must be a positive whole number of paise and stock must be a whole number, 0 or more');
    }
  }

  const productId = `prod-${crypto.randomUUID()}`;
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;

  await ProductModel.create({
    _id: productId,
    shopId,
    sellerId,
    categoryId,
    name,
    slug,
    description: description || '',
    status: 'PENDING_REVIEW',
    images: images || [],
    basePricePaise: finalPrice,
    sku,
    brand: brand || '',
    tags: [],
    rating: 5.0,
    reviewCount: 0,
    inventoryTotal: 0,
  });

  for (const v of variantInputs) {
    {
      const variantId = `var-${crypto.randomUUID()}`;
      const varPrice = v.pricePaise ?? v.priceCents ?? finalPrice;
      const varQty = v.inventoryQuantity ?? 10;
      await ProductVariantModel.create({
        _id: variantId,
        productId,
        name: v.name || 'Standard',
        sku: v.sku || `${sku}-${Math.floor(Math.random() * 1000)}`,
        pricePaise: varPrice,
        compareAtPricePaise: v.compareAtPricePaise ?? v.compareAtPriceCents ?? undefined,
        inventoryQuantity: varQty,
        attributes: v.attributes || {},
      });

      await InventoryModel.create({
        _id: `inv_${variantId}`,
        stockItemId: variantId,
        productId,
        sellerId,
        totalQuantity: varQty,
        reservedQuantity: 0,
      });
    }
  }

  res.status(201).json({
    success: true,
    message: 'Product submitted for administrative moderation',
    productId,
  });
});

// ----------------------------------------------------
// Seller Dashboard Analytics (requireApprovedSeller)
// ----------------------------------------------------
apiRouter.get('/seller/dashboard', requireApprovedSeller, async (req, res) => {
  const sellerId = req.auth!.sellerProfileId!;

  const [sellerOrders, products, ledgerEntries] = await Promise.all([
    SellerOrderModel.find({ sellerId }),
    ProductModel.find({ sellerId }),
    LedgerEntryModel.find({ sellerId }).sort({ createdAt: -1 }),
  ]);

  const balance = calculateSellerBalance(sellerId, ledgerEntries);

  let totalGross = 0;
  let totalCommissionsPaid = 0;
  let pendingOrdersCount = 0;

  for (const so of sellerOrders) {
    totalGross += so.totalPaise;
    totalCommissionsPaid += so.commissionTotalPaise;
    if (so.status === 'PROCESSING' || so.status === 'PENDING_PAYMENT') {
      pendingOrdersCount++;
    }
  }

  res.json({
    analytics: {
      totalGrossPaise: totalGross,
      totalGrossCents: totalGross,
      totalCommissionsPaidPaise: totalCommissionsPaid,
      totalCommissionsPaidCents: totalCommissionsPaid,
      totalNetEarningsPaise: balance.totalEarningsPaise,
      totalNetEarningsCents: balance.totalEarningsPaise,
      availableBalancePaise: balance.availablePaise,
      availableBalanceCents: balance.availablePaise,
      totalOrdersCount: sellerOrders.length,
      pendingOrdersCount,
      totalProductsCount: products.length,
    },
    balance,
    recentLedger: ledgerEntries.slice(0, 10),
  });
});

// ----------------------------------------------------
// Admin Routes — ALL require ADMIN role
// ----------------------------------------------------
apiRouter.use('/admin', requireRole('ADMIN'));

apiRouter.patch('/orders/:id/status', requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return sendError(res, 400, 'MISSING_STATUS', 'Status is required');

  const ord = await OrderModel.findOne({
    $or: [{ _id: id }, { orderNumber: id }],
  });
  if (!ord) return sendError(res, 404, 'NOT_FOUND', 'Order not found');

  const now = new Date();
  ord.status = status;
  await ord.save();

  if (status === 'SHIPPED') {
    await SellerOrderModel.updateMany(
      { parentOrderId: ord.id, status: { $ne: 'REFUNDED' } },
      {
        $set: {
          status: 'SHIPPED',
          shippingCarrier: 'Blue Dart Air Express',
          shippedAt: now,
        },
      }
    );
  } else if (status === 'DELIVERED') {
    await SellerOrderModel.updateMany(
      { parentOrderId: ord.id, status: { $ne: 'REFUNDED' } },
      {
        $set: {
          status: 'DELIVERED',
          shippingCarrier: 'Blue Dart Air Express',
          shippedAt: now,
          deliveredAt: now,
        },
      }
    );
  } else if (status === 'PROCESSING') {
    await SellerOrderModel.updateMany(
      { parentOrderId: ord.id, status: { $ne: 'REFUNDED' } },
      { $set: { status: 'PROCESSING', deliveredAt: undefined } }
    );
  }

  const updated = await formatOrderResponse(ord);
  res.json({ success: true, order: updated });
});

apiRouter.get('/admin/analytics', async (_req, res) => {
  const [totalOrders, activeSellersCount, pendingSellersCount, pendingProductsCount, orders, sellerOrders] =
    await Promise.all([
      OrderModel.countDocuments(),
      SellerProfileModel.countDocuments({ status: 'APPROVED' }),
      SellerProfileModel.countDocuments({ status: 'PENDING' }),
      ProductModel.countDocuments({ status: 'PENDING_REVIEW' }),
      OrderModel.find({ status: { $ne: 'CANCELLED' } }),
      SellerOrderModel.find({ status: { $ne: 'CANCELLED' } }),
    ]);

  const grossSalesPaise = orders.reduce((sum, o) => sum + o.totalPaise, 0);
  const platformCommissionsPaise = sellerOrders.reduce((sum, so) => sum + so.commissionTotalPaise, 0);

  res.json({
    grossSalesPaise,
    grossSalesCents: grossSalesPaise,
    platformCommissionsPaise,
    platformCommissionsCents: platformCommissionsPaise,
    totalOrders,
    activeSellersCount,
    pendingSellersCount,
    pendingProductsCount,
  });
});

apiRouter.get('/admin/sellers', async (_req, res) => {
  const sellers = await SellerProfileModel.find().sort({ appliedAt: -1 });

  const formatted = await Promise.all(
    sellers.map(async (sp) => {
      const [user, shop] = await Promise.all([
        UserModel.findById(sp.userId),
        ShopModel.findOne({ sellerId: sp.id }),
      ]);

      return {
        ...sp.toJSON(),
        ownerName: user ? user.fullName : undefined,
        ownerEmail: user ? user.email : undefined,
        shopName: shop ? shop.name : undefined,
        shopSlug: shop ? shop.slug : undefined,
        gstin: sp.gstin || sp.businessRegistrationNumber || '',
        pan: sp.pan || sp.taxId || '',
        ifsc: sp.ifsc || sp.bankDetails?.routingOrIfsc || '',
        bankDetails: sp.bankDetails || {},
      };
    })
  );

  res.json({ sellers: formatted });
});

apiRouter.patch('/admin/sellers/:id/status', async (req, res) => {
  const { id } = req.params;
  const actorId = req.auth!.userId;
  const { status, rejectionReason } = req.body;

  const seller = await SellerProfileModel.findById(id);
  if (!seller) return sendError(res, 404, 'NOT_FOUND', 'Seller profile not found');

  const now = new Date();

  if (status === 'APPROVED') {
    seller.status = 'APPROVED';
    seller.approvedAt = now;
    await seller.save();

    await UserModel.updateOne({ _id: seller.userId }, { $set: { role: 'SELLER' } });

    const existingShop = await ShopModel.findOne({ sellerId: id });
    if (!existingShop) {
      // Two sellers can have the same business name, but shop addresses (slugs) must be unique
      const baseSlug = seller.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'shop';
      let slug = baseSlug;
      for (let n = 2; await ShopModel.exists({ slug }); n++) {
        slug = `${baseSlug}-${n}`;
      }
      await ShopModel.create({
        _id: `shop-${crypto.randomUUID()}`,
        sellerId: id,
        name: seller.businessName,
        slug,
        tagline: 'Premier verified vendor on MarketSphere India',
        description: 'High quality curated products fulfilled with care and national warranty.',
        logoUrl: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200',
        shippingPolicy: 'Dispatched in 24-48 hours via Blue Dart Express across India.',
        refundPolicy: '7-day replacement guarantee for manufacturing defects.',
        rating: 5.0,
        reviewCount: 0,
        isActive: true,
      });
    }
  } else if (status === 'REJECTED') {
    seller.status = 'REJECTED';
    seller.rejectionReason = rejectionReason || 'KYC verification failure';
    await seller.save();
  }

  await AuditLogModel.create({
    _id: `audit_${crypto.randomUUID()}`,
    actorId,
    actorRole: 'ADMIN',
    action: 'UPDATE_SELLER_STATUS',
    targetType: 'SELLER_PROFILE',
    targetId: id,
    details: { status, rejectionReason },
    timestamp: now,
  });

  res.json({ success: true, status });
});

apiRouter.get('/admin/products/moderation', async (_req, res) => {
  const products = await ProductModel.find({ status: 'PENDING_REVIEW' }).sort({ createdAt: 1 });

  const detailed = await Promise.all(
    products.map(async (p) => {
      const [shop, cat, seller] = await Promise.all([
        ShopModel.findById(p.shopId),
        CategoryModel.findById(p.categoryId),
        SellerProfileModel.findById(p.sellerId),
      ]);

      return {
        ...p.toJSON(),
        shopName: shop ? shop.name : undefined,
        categoryName: cat ? cat.name : undefined,
        businessName: seller ? seller.businessName : undefined,
      };
    })
  );

  res.json({ products: detailed });
});

apiRouter.patch('/admin/products/:id/moderation', async (req, res) => {
  const { id } = req.params;
  const actorId = req.auth!.userId;
  const { status } = req.body;

  const product = await ProductModel.findById(id);
  if (!product) return sendError(res, 404, 'NOT_FOUND', 'Product not found');

  product.status = status;
  await product.save();

  await AuditLogModel.create({
    _id: `audit_${crypto.randomUUID()}`,
    actorId,
    actorRole: 'ADMIN',
    action: 'MODERATE_PRODUCT',
    targetType: 'PRODUCT',
    targetId: id,
    details: { status },
    timestamp: new Date(),
  });

  res.json({ success: true, status });
});

apiRouter.get('/admin/commission-rules', async (_req, res) => {
  const rules = await CommissionRuleModel.find().sort({ scope: -1 });
  res.json({ rules });
});

apiRouter.post('/admin/commission-rules', async (req, res) => {
  const { scope, targetId, percentageRate, description } = req.body;
  const ruleId = `rule-${crypto.randomUUID()}`;

  await CommissionRuleModel.create({
    _id: ruleId,
    scope,
    targetId: targetId || undefined,
    percentageRate,
    description: description || '',
  });

  res.status(201).json({ success: true, ruleId });
});

apiRouter.get('/admin/ledger', async (_req, res) => {
  const entries = await LedgerEntryModel.find().sort({ createdAt: -1 }).limit(100);
  res.json({ entries });
});

apiRouter.post('/admin/refunds', async (req, res) => {
  const actorId = req.auth!.userId;
  const { orderId, sellerOrderId, amountPaise, amountCents, reason } = req.body;

  try {
    const result = await PaymentGatewayService.processRefund({
      orderId,
      sellerOrderId,
      amountPaise: amountPaise ?? amountCents,
      reason: reason || 'Admin refund',
      actorId,
      actorRole: 'ADMIN',
    });
    res.json(result);
  } catch (err: any) {
    sendError(res, 400, 'REFUND_ERROR', err.message);
  }
});

apiRouter.get('/admin/audit-logs', async (_req, res) => {
  const logs = await AuditLogModel.find().sort({ timestamp: -1 }).limit(50);
  res.json({ logs });
});

// ----------------------------------------------------
// Admin User Management — Only Admin can view & manage roles
// ----------------------------------------------------
apiRouter.get('/admin/users', async (req, res) => {
  const { search, role } = req.query;
  const filter: any = {};

  if (role && ['CUSTOMER', 'SELLER', 'ADMIN'].includes(role as string)) {
    filter.role = role;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { fullName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ];
  }

  const users = await UserModel.find(filter).sort({ createdAt: -1 });

  const formattedUsers = await Promise.all(
    users.map(async (u) => {
      let shop = null;
      let sellerProfile = null;
      if (u.role === 'SELLER') {
        sellerProfile = await SellerProfileModel.findOne({ userId: u.id });
        if (sellerProfile) {
          shop = await ShopModel.findOne({ sellerId: sellerProfile.id });
        }
      }

      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        phone: u.phone,
        avatarUrl: u.avatarUrl,
        isBlocked: u.isBlocked,
        createdAt: u.createdAt,
        shop: shop ? { id: shop.id, name: shop.name, slug: shop.slug } : null,
        sellerProfile: sellerProfile ? { id: sellerProfile.id, status: sellerProfile.status } : null,
      };
    })
  );

  res.json({ users: formattedUsers });
});

apiRouter.patch('/admin/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const actorId = req.auth!.userId;
  const { role } = req.body;

  if (!role || !['CUSTOMER', 'SELLER'].includes(role)) {
    return sendError(
      res,
      400,
      'INVALID_ROLE',
      'Admins can only assign Customer or Seller roles. Assigning or creating additional Admin roles is prohibited.'
    );
  }

  const user = await UserModel.findById(id);
  if (!user) {
    return sendError(res, 404, 'NOT_FOUND', 'User account not found');
  }

  // Protect system Admin account
  if (user.role === 'ADMIN') {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'The primary Administrator account cannot be modified or demoted.'
    );
  }

  const previousRole = user.role;
  user.role = role;
  await user.save();

  // If promoted to SELLER, ensure seller profile and shop exist
  if (role === 'SELLER') {
    let profile = await SellerProfileModel.findOne({ userId: user.id });
    if (!profile) {
      profile = await SellerProfileModel.create({
        _id: `seller-prof-${crypto.randomUUID()}`,
        userId: user.id,
        businessName: `${user.fullName}'s Store`,
        contactEmail: user.email,
        contactPhone: user.phone || '+91 99999 99999',
        status: 'APPROVED',
        appliedAt: new Date(),
        approvedAt: new Date(),
      });
    } else if (profile.status !== 'APPROVED') {
      profile.status = 'APPROVED';
      profile.approvedAt = new Date();
      await profile.save();
    }

    const existingShop = await ShopModel.findOne({ sellerId: profile.id });
    if (!existingShop) {
      const baseSlug = profile.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'shop';
      let slug = baseSlug;
      for (let n = 2; await ShopModel.exists({ slug }); n++) {
        slug = `${baseSlug}-${n}`;
      }
      await ShopModel.create({
        _id: `shop-${crypto.randomUUID()}`,
        sellerId: profile.id,
        name: profile.businessName,
        slug,
        tagline: 'Verified independent vendor on MarketSphere',
        description: 'Quality curated products fulfilled with care and direct warranty.',
        rating: 5.0,
        reviewCount: 0,
        isActive: true,
      });
    }
  }

  await AuditLogModel.create({
    _id: `audit_${crypto.randomUUID()}`,
    actorId,
    actorRole: 'ADMIN',
    action: 'UPDATE_USER_ROLE',
    targetType: 'USER',
    targetId: user.id,
    details: { previousRole, newRole: role, targetEmail: user.email },
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: `User role successfully updated to ${role}`,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  });
});

apiRouter.patch('/admin/users/:id/block', async (req, res) => {
  const { id } = req.params;
  const actorId = req.auth!.userId;

  const user = await UserModel.findById(id);
  if (!user) {
    return sendError(res, 404, 'NOT_FOUND', 'User account not found');
  }

  if (user.role === 'ADMIN') {
    return sendError(res, 403, 'FORBIDDEN', 'The primary Administrator account cannot be blocked.');
  }

  user.isBlocked = !user.isBlocked;
  await user.save();

  await AuditLogModel.create({
    _id: `audit_${crypto.randomUUID()}`,
    actorId,
    actorRole: 'ADMIN',
    action: user.isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
    targetType: 'USER',
    targetId: user.id,
    details: { isBlocked: user.isBlocked, targetEmail: user.email },
    timestamp: new Date(),
  });

  res.json({
    success: true,
    isBlocked: user.isBlocked,
    message: user.isBlocked ? 'User account has been blocked' : 'User account has been unblocked',
  });
});


// ----------------------------------------------------
// Customer Reviews (requireAuth, verified purchase, once)
// ----------------------------------------------------
apiRouter.post('/reviews', requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const { productId, rating, title, comment } = req.body;

  if (!productId || !rating || !comment) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Product, rating, and comment are required');
  }

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return sendError(res, 400, 'INVALID_RATING', 'Rating must be an integer between 1 and 5');
  }

  const user = await UserModel.findById(userId);
  if (!user) return sendError(res, 404, 'USER_NOT_FOUND', 'User not found');

  // Check verified purchase
  const eligibleOrders = await OrderModel.find({
    customerId: userId,
    status: { $in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'] },
  });

  const orderIds = eligibleOrders.map((o) => o.id);
  const purchasedItem = await OrderItemModel.findOne({
    productId,
    orderId: { $in: orderIds },
  });

  if (!purchasedItem) {
    return sendError(res, 403, 'NOT_PURCHASED', 'Only customers who purchased this product can review it');
  }

  // One review per user per product
  const alreadyReviewed = await ReviewModel.findOne({ productId, userId });
  if (alreadyReviewed) {
    return sendError(res, 409, 'ALREADY_REVIEWED', 'You have already submitted a review for this product');
  }

  const reviewId = `rev-${crypto.randomUUID()}`;
  await ReviewModel.create({
    _id: reviewId,
    productId,
    userId,
    userName: user.fullName,
    rating: ratingNum,
    title: title || '',
    comment,
    verifiedPurchase: true,
  });

  // Update product average rating and count
  const allReviews = await ReviewModel.find({ productId });
  const totalScore = allReviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = Number((totalScore / allReviews.length).toFixed(1));

  await ProductModel.updateOne(
    { _id: productId },
    { $set: { rating: avgRating, reviewCount: allReviews.length } }
  );

  res.status(201).json({ success: true, reviewId, verifiedPurchase: true });
});
