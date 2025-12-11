/**
 * Pure Commission Engine for MarketSphere
 * Enforces precedence rules, integer minor-units arithmetic, and transparent allocations.
 * Precedence: Seller-specific rate > Category-specific rate > Marketplace default rate.
 * All monetary amounts are in integer minor units: for INR that is paise (100 paise = ₹1).
 */

export interface CommissionContext {
  marketplaceDefaultRate: number; // e.g. 0.10 (10%)
  categoryRates: Record<string, number>; // categoryId -> rate
  sellerRates: Record<string, number>; // sellerId -> rate
}

export interface LineItemForCommission {
  productId: string;
  sellerId: string;
  categoryId: string;
  unitPricePaise: number;
  unitPriceCents?: number; // backwards compatibility alias
  quantity: number;
}

export interface CommissionCalculationResult {
  grossMerchandisePaise: number;
  allocatedDiscountPaise: number;
  commissionBasePaise: number;
  commissionRate: number;
  commissionAmountPaise: number;
  sellerPayablePaise: number;
  // Aliases for transition
  grossMerchandiseCents?: number;
  allocatedDiscountCents?: number;
  commissionBaseCents?: number;
  commissionAmountCents?: number;
  sellerPayableCents?: number;
}

/**
 * Resolves the applicable commission rate based on strict precedence:
 * Seller override > Category rate > Marketplace default.
 */
export function resolveCommissionRate(
  context: CommissionContext,
  sellerId: string,
  categoryId: string
): number {
  if (context.sellerRates[sellerId] !== undefined) {
    return context.sellerRates[sellerId];
  }
  if (context.categoryRates[categoryId] !== undefined) {
    return context.categoryRates[categoryId];
  }
  return context.marketplaceDefaultRate;
}

/**
 * Proportionally allocates an order-level discount across items with integer paise precision.
 * Residual paise from rounding are allocated to the largest line item to ensure the total discount matches exactly.
 */
export function allocateDiscounts(
  items: { id: string; grossPaise?: number; grossCents?: number }[],
  totalDiscountPaise: number
): Record<string, number> {
  const allocations: Record<string, number> = {};
  if (items.length === 0 || totalDiscountPaise <= 0) {
    for (const item of items) allocations[item.id] = 0;
    return allocations;
  }

  const normalizedItems = items.map((it) => ({
    id: it.id,
    grossPaise: it.grossPaise ?? it.grossCents ?? 0,
  }));

  const totalGrossPaise = normalizedItems.reduce((sum, it) => sum + it.grossPaise, 0);
  if (totalGrossPaise <= 0) {
    for (const item of items) allocations[item.id] = 0;
    return allocations;
  }

  // Cap discount at total gross to prevent negative net
  const effectiveDiscount = Math.min(totalDiscountPaise, totalGrossPaise);
  let allocatedSoFar = 0;
  let maxItemIdx = 0;
  let maxGross = -1;

  for (let i = 0; i < normalizedItems.length; i++) {
    const it = normalizedItems[i];
    if (it.grossPaise > maxGross) {
      maxGross = it.grossPaise;
      maxItemIdx = i;
    }
    const share = Math.floor((it.grossPaise * effectiveDiscount) / totalGrossPaise);
    allocations[it.id] = share;
    allocatedSoFar += share;
  }

  // Distribute residual rounding paise to highest-value item
  const remainder = effectiveDiscount - allocatedSoFar;
  if (remainder > 0 && normalizedItems.length > 0) {
    const luckyId = normalizedItems[maxItemIdx].id;
    allocations[luckyId] += remainder;
  }

  return allocations;
}

/**
 * Calculates item-level commission and seller payable amount.
 * All math in integer minor units (paise).
 */
export function calculateItemCommission(
  item: LineItemForCommission,
  allocatedDiscountPaise: number,
  rate: number
): CommissionCalculationResult {
  const unitPrice = item.unitPricePaise ?? item.unitPriceCents ?? 0;
  const grossMerchandisePaise = Math.round(unitPrice * item.quantity);
  const cappedDiscount = Math.min(allocatedDiscountPaise, grossMerchandisePaise);
  const commissionBasePaise = grossMerchandisePaise - cappedDiscount;

  // Rate applied to net merchandise value (after item's share of discount)
  const commissionAmountPaise = Math.round(commissionBasePaise * rate);
  const sellerPayablePaise = commissionBasePaise - commissionAmountPaise;

  return {
    grossMerchandisePaise,
    allocatedDiscountPaise: cappedDiscount,
    commissionBasePaise,
    commissionRate: rate,
    commissionAmountPaise,
    sellerPayablePaise,
    // Provide Cents aliases for backwards compatibility
    grossMerchandiseCents: grossMerchandisePaise,
    allocatedDiscountCents: cappedDiscount,
    commissionBaseCents: commissionBasePaise,
    commissionAmountCents: commissionAmountPaise,
    sellerPayableCents: sellerPayablePaise,
  };
}

/**
 * Computes reversal breakdown when a full or partial refund is processed.
 */
export function calculateRefundReversal(
  originalResult: CommissionCalculationResult,
  refundMerchandisePaise: number
): {
  refundMerchandisePaise: number;
  sellerDeductionPaise: number;
  commissionReversalPaise: number;
  // Aliases
  refundMerchandiseCents?: number;
  sellerDeductionCents?: number;
  commissionReversalCents?: number;
} {
  const basePaise = originalResult.commissionBasePaise ?? originalResult.commissionBaseCents ?? 0;
  const commPaise = originalResult.commissionAmountPaise ?? originalResult.commissionAmountCents ?? 0;
  const cappedRefund = Math.min(refundMerchandisePaise, basePaise);

  if (cappedRefund <= 0 || basePaise <= 0) {
    return {
      refundMerchandisePaise: 0,
      sellerDeductionPaise: 0,
      commissionReversalPaise: 0,
      refundMerchandiseCents: 0,
      sellerDeductionCents: 0,
      commissionReversalCents: 0,
    };
  }

  const ratio = cappedRefund / basePaise;
  const commissionReversalPaise = Math.round(commPaise * ratio);
  const sellerDeductionPaise = cappedRefund - commissionReversalPaise;

  return {
    refundMerchandisePaise: cappedRefund,
    sellerDeductionPaise,
    commissionReversalPaise,
    refundMerchandiseCents: cappedRefund,
    sellerDeductionCents: sellerDeductionPaise,
    commissionReversalCents: commissionReversalPaise,
  };
}
