import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../app.ts';
import { LedgerEntryModel, OrderItemModel, OrderModel, SellerOrderModel } from '../models/index.ts';
import { startTestDb } from './testDb.ts';
import { FLAT_SHIPPING_PAISE, FREE_SHIPPING_THRESHOLD_PAISE, GST_RATE_PERCENT } from '../config.ts';

let server: Server;
let baseUrl: string;
let stopDb: () => Promise<void>;

test.before(async () => {
  stopDb = await startTestDb();
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await stopDb();
});

test('Seeded data invariants: orders, suborders, items, commission, and ledger', async () => {
  const orders = await OrderModel.find().lean();
  assert.ok(orders.length > 0, 'Seeded orders must exist');

  for (const ord of orders) {
    // 1. Order total arithmetic
    const expectedTotal = ord.subtotalPaise - ord.discountPaise + ord.shippingPaise + ord.taxPaise;
    assert.equal(ord.totalPaise, expectedTotal, `Order ${ord._id} total must match subtotal - discount + shipping + tax`);

    // 2. Seller suborders sum matches parent order
    const sellerOrders = await SellerOrderModel.find({ parentOrderId: ord._id }).lean();
    assert.ok(sellerOrders.length > 0, `Order ${ord._id} must have seller orders`);

    const sum = (key: 'totalPaise' | 'subtotalPaise' | 'shippingPaise' | 'taxPaise' | 'discountPaise') =>
      sellerOrders.reduce((acc, so) => acc + so[key], 0);
    assert.equal(sum('totalPaise'), ord.totalPaise, 'Sum of seller totals must equal order total');
    assert.equal(sum('subtotalPaise'), ord.subtotalPaise, 'Sum of seller subtotals must equal order subtotal');
    assert.equal(sum('shippingPaise'), ord.shippingPaise, 'Sum of seller shipping must equal order shipping');
    assert.equal(sum('taxPaise'), ord.taxPaise, 'Sum of seller tax must equal order tax');
    assert.equal(sum('discountPaise'), ord.discountPaise, 'Sum of seller discount must equal order discount');

    // 3. Suborder items and commission math
    for (const so of sellerOrders) {
      const soItems = await OrderItemModel.find({ sellerOrderId: so._id }).lean();
      assert.ok(soItems.length > 0, `Suborder ${so._id} must have items`);

      let calculatedCommTotal = 0;
      let calculatedSellerItemsPayable = 0;

      for (const it of soItems) {
        const netItemValue = it.totalPaise - it.allocatedDiscountPaise;
        const expectedCommission = Math.round(netItemValue * it.commissionRate);
        assert.equal(it.commissionAmountPaise, expectedCommission, `Item ${it._id} commission must be rate * net item value`);
        assert.equal(it.sellerPayablePaise, netItemValue - expectedCommission, `Item ${it._id} seller payable must be net item value - commission`);
        calculatedCommTotal += it.commissionAmountPaise;
        calculatedSellerItemsPayable += it.sellerPayablePaise;
      }

      assert.equal(so.commissionTotalPaise, calculatedCommTotal, 'Suborder commission total must match item sum');
      assert.equal(
        so.sellerNetPayablePaise,
        calculatedSellerItemsPayable + so.shippingPaise,
        'Suborder seller net payable must include items payable + shipping'
      );
    }

    // 4. Ledger debits equal credits for order
    const ledger = await LedgerEntryModel.find({ orderId: ord._id }).lean();
    assert.ok(ledger.length > 0, `Order ${ord._id} must have ledger entries`);
    const totalDebits = ledger.reduce((acc, e) => acc + e.debitPaise, 0);
    const totalCredits = ledger.reduce((acc, e) => acc + e.creditPaise, 0);
    assert.equal(totalDebits, totalCredits, `Ledger must balance (Debits ${totalDebits} == Credits ${totalCredits})`);
  }
});

test('Quote engine: GST is 18% of taxable amount in integer paise', async () => {
  // Test with prod-1 (Apex Wave @ ₹23,999 = 2399900 paise)
  const res = await fetch(`${baseUrl}/checkout/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'prod-1', variantId: 'var-1-1', quantity: 1 }],
    }),
  });
  assert.equal(res.status, 200);
  const data = (await res.json()) as any;
  const quote = data.quote;

  assert.equal(quote.subtotalPaise, 2399900);
  assert.equal(quote.discountPaise, 0);
  // 18% GST on 2399900 = round(2399900 * 0.18) = 431982 paise
  const expectedTax = Math.round(2399900 * (GST_RATE_PERCENT / 100));
  assert.equal(quote.taxPaise, expectedTax);
  assert.equal(quote.taxLabel, 'GST (18%)');
  assert.equal(quote.currency, 'INR');
});

test('Quote engine: shipping is ₹49 below ₹999 and free at or above ₹999', async () => {
  // 1. Package below ₹999 threshold: Lumina Accessory (prod-4, var-4-2 @ ₹749 = 74900 paise)
  const resBelow = await fetch(`${baseUrl}/checkout/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'prod-4', variantId: 'var-4-2', quantity: 1 }],
    }),
  });
  assert.equal(resBelow.status, 200);
  const dataBelow = (await resBelow.json()) as any;
  assert.equal(dataBelow.quote.shippingPaise, FLAT_SHIPPING_PAISE); // 4900 paise (₹49)

  // 2. Package at or above ₹999 threshold: (prod-4, var-4-1 @ ₹5,499 = 549900 paise)
  const resAbove = await fetch(`${baseUrl}/checkout/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'prod-4', variantId: 'var-4-1', quantity: 1 }],
    }),
  });
  assert.equal(resAbove.status, 200);
  const dataAbove = (await resAbove.json()) as any;
  assert.equal(dataAbove.quote.shippingPaise, 0); // Free shipping
});

test('Quote engine: SAVE25 coupon applies only at ₹1,500 or more', async () => {
  // 1. Below ₹1,500 threshold (74900 paise < 150000 paise): coupon should NOT apply
  const resBelow = await fetch(`${baseUrl}/checkout/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'prod-4', variantId: 'var-4-2', quantity: 1 }],
      couponCode: 'SAVE25',
    }),
  });
  const dataBelow = (await resBelow.json()) as any;
  assert.equal(dataBelow.quote.couponApplied, null);
  assert.equal(dataBelow.quote.discountPaise, 0);

  // 2. At or above ₹1,500 threshold (prod-2 @ ₹14,999 = 1499900 paise): should apply ₹250 (25000 paise) off
  const resAbove = await fetch(`${baseUrl}/checkout/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'prod-2', quantity: 1 }],
      couponCode: 'SAVE25',
    }),
  });
  const dataAbove = (await resAbove.json()) as any;
  assert.equal(dataAbove.quote.couponApplied, 'SAVE25');
  assert.equal(dataAbove.quote.discountPaise, 25000); // ₹250 off
});

test('Quote engine: two-seller cart splits shipping and GST correctly with matching totals', async () => {
  // Cart with:
  // Seller 1 (Apex): prod-1 @ ₹23,999 (subtotal >= ₹999 -> free shipping = 0)
  // Seller 2 (Lumina): prod-4 var-4-2 @ ₹749 (subtotal < ₹999 -> shipping = ₹49 / 4900 paise)
  const res = await fetch(`${baseUrl}/checkout/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { productId: 'prod-1', variantId: 'var-1-1', quantity: 1 },
        { productId: 'prod-4', variantId: 'var-4-2', quantity: 1 },
      ],
      couponCode: 'WELCOME10', // 10% off
    }),
  });
  assert.equal(res.status, 200);
  const data = (await res.json()) as any;
  const quote = data.quote;

  assert.equal(quote.sellerOrders.length, 2, 'Must have 2 seller suborders');

  const apexOrder = quote.sellerOrders.find((s: any) => s.sellerId === 'seller-prof-1');
  const luminaOrder = quote.sellerOrders.find((s: any) => s.sellerId === 'seller-prof-2');
  assert.ok(apexOrder);
  assert.ok(luminaOrder);

  // Check shipping per package
  assert.equal(apexOrder.shippingPaise, 0, 'Apex package is >= ₹999 so shipping is free');
  assert.equal(luminaOrder.shippingPaise, 4900, 'Lumina package is < ₹999 so shipping is ₹49');
  assert.equal(quote.shippingPaise, 4900);

  // Check sum of seller orders equals grand total
  const sumSellerTotals = apexOrder.totalPaise + luminaOrder.totalPaise;
  assert.equal(sumSellerTotals, quote.totalPaise, 'Grand total must equal sum of seller totals');

  const sumSellerTax = apexOrder.taxPaise + luminaOrder.taxPaise;
  assert.equal(sumSellerTax, quote.taxPaise, 'Grand tax must equal sum of seller taxes');

  const sumSellerDiscount = apexOrder.discountPaise + luminaOrder.discountPaise;
  assert.equal(sumSellerDiscount, quote.discountPaise, 'Grand discount must equal sum of seller discounts');
});
