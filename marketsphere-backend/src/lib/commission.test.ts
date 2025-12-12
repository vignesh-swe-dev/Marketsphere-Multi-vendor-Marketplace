import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCommissionRate,
  allocateDiscounts,
  calculateItemCommission,
  calculateRefundReversal,
  type CommissionContext
} from './commission.ts';

test('Commission precedence: seller override takes top priority', () => {
  const context: CommissionContext = {
    marketplaceDefaultRate: 0.10, // 10%
    categoryRates: { 'cat-electronics': 0.15 },
    sellerRates: { 'seller-vip': 0.06 },
  };

  const rate = resolveCommissionRate(context, 'seller-vip', 'cat-electronics');
  assert.equal(rate, 0.06, 'Should pick seller-specific rate 6% over category 15%');
});

test('Commission precedence: category rate takes priority when no seller override', () => {
  const context: CommissionContext = {
    marketplaceDefaultRate: 0.10,
    categoryRates: { 'cat-fashion': 0.12 },
    sellerRates: {},
  };

  const rate = resolveCommissionRate(context, 'seller-regular', 'cat-fashion');
  assert.equal(rate, 0.12, 'Should pick category rate 12% over default 10%');
});

test('Commission precedence: default marketplace rate when no overrides exist', () => {
  const context: CommissionContext = {
    marketplaceDefaultRate: 0.10,
    categoryRates: {},
    sellerRates: {},
  };

  const rate = resolveCommissionRate(context, 'seller-new', 'cat-misc');
  assert.equal(rate, 0.10, 'Should fall back to default rate 10%');
});

test('allocateDiscounts distributes discount with exact penny precision and no lost cents', () => {
  const items = [
    { id: 'item1', grossPaise: 3333 }, // 3333 paise
    { id: 'item2', grossPaise: 3333 }, // 3333 paise
    { id: 'item3', grossPaise: 3334 }, // 3334 paise
  ];
  const totalDiscount = 1000; // 1000 paise coupon (₹10.00)

  const allocations = allocateDiscounts(items, totalDiscount);
  const sumAllocated = Object.values(allocations).reduce((a, b) => a + b, 0);

  assert.equal(sumAllocated, 1000, 'Sum of allocated discount cents must equal total discount exactly');
  assert.equal(allocations['item3'], 334, 'Largest item receives remaining penny');
});

test('calculateItemCommission correctly computes base, commission amount, and seller payable', () => {
  const item = {
    productId: 'p1',
    sellerId: 's1',
    categoryId: 'c1',
    unitPricePaise: 4999, // ₹49.99 (4999 paise)
    quantity: 2,           // Total ₹99.98 (9998 paise)
  };
  const allocatedDiscountPaise = 998; // ₹9.98 discount (998 paise)
  const rate = 0.10; // 10%

  const result = calculateItemCommission(item, allocatedDiscountPaise, rate);

  assert.equal(result.grossMerchandisePaise, 9998);
  assert.equal(result.allocatedDiscountPaise, 998);
  assert.equal(result.commissionBasePaise, 9000); // 9998 - 998 = 9000 paise (₹90.00)
  assert.equal(result.commissionAmountPaise, 900); // 10% of 9000 = 900 paise (₹9.00)
  assert.equal(result.sellerPayablePaise, 8100);   // 9000 - 900 = 8100 paise (₹81.00)
  assert.equal(
    result.commissionAmountPaise + result.sellerPayablePaise,
    result.commissionBasePaise,
    'Commission + Seller Payable must equal Commission Base'
  );
});

test('calculateRefundReversal splits refund between seller deduction and marketplace commission reversal', () => {
  const original = {
    grossMerchandisePaise: 10000,
    allocatedDiscountPaise: 0,
    commissionBasePaise: 10000,
    commissionRate: 0.10,
    commissionAmountPaise: 1000,
    sellerPayablePaise: 9000,
  };

  // Full refund
  const fullRefund = calculateRefundReversal(original, 10000);
  assert.equal(fullRefund.refundMerchandisePaise, 10000);
  assert.equal(fullRefund.commissionReversalPaise, 1000);
  assert.equal(fullRefund.sellerDeductionPaise, 9000);

  // Partial 50% refund
  const partialRefund = calculateRefundReversal(original, 5000);
  assert.equal(partialRefund.refundMerchandisePaise, 5000);
  assert.equal(partialRefund.commissionReversalPaise, 500);
  assert.equal(partialRefund.sellerDeductionPaise, 4500);
  assert.equal(
    partialRefund.commissionReversalPaise + partialRefund.sellerDeductionPaise,
    5000,
    'Reversed amounts must sum to refunded amount'
  );
});
