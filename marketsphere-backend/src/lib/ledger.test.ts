import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTransactionBalance,
  createOrderLedgerPostings,
  createRefundLedgerPostings,
  calculateSellerBalance,
  type LedgerPosting
} from './ledger.ts';
import type { LedgerEntry } from '../types/index.ts';

test('createOrderLedgerPostings creates balanced transaction (Debits == Credits)', () => {
  const postings = createOrderLedgerPostings({
    orderId: 'ord-1001',
    sellerId: 'seller-apex',
    grossPaise: 11500, // ₹115.00 customer paid (11500 paise)
    sellerPayablePaise: 9000, // ₹90.00 seller net (9000 paise)
    commissionPaise: 1000,    // ₹10.00 marketplace fee (1000 paise)
    taxPaise: 1000,           // ₹10.00 GST (1000 paise)
    shippingPaise: 500,       // ₹5.00 shipping fee (500 paise)
  });

  const check = validateTransactionBalance(postings);
  assert.equal(check.isBalanced, true, 'Debits and credits must be equal');
  assert.equal(check.totalDebits, 11500);
  assert.equal(check.totalCredits, 11500);
  assert.equal(check.difference, 0);
});

test('createRefundLedgerPostings creates balanced compensating entries', () => {
  const postings = createRefundLedgerPostings({
    orderId: 'ord-1001',
    sellerId: 'seller-apex',
    refundMerchandisePaise: 10000, // ₹100 refund (10000 paise)
    sellerDeductionPaise: 9000,    // ₹90 from seller (9000 paise)
    commissionReversalPaise: 1000, // ₹10 from marketplace (1000 paise)
  });

  const check = validateTransactionBalance(postings);
  assert.equal(check.isBalanced, true, 'Refund compensating transaction must balance');
  assert.equal(check.totalDebits, 10000);
  assert.equal(check.totalCredits, 10000);
});

test('calculateSellerBalance aggregates net available balance, payouts, and refunds', () => {
  const sellerId = 'seller-apex';
  const entries: LedgerEntry[] = [
    // Order 1: Earned ₹80 (8000 paise)
    {
      id: 'e1',
      transactionId: 't1',
      sellerId,
      type: 'SELLER_PAYABLE',
      debitPaise: 0,
      creditPaise: 8000,
      description: 'Order 1 earnings',
      createdAt: '2026-10-01T10:00:00Z',
    },
    // Order 2: Earned ₹50 (5000 paise)
    {
      id: 'e2',
      transactionId: 't2',
      sellerId,
      type: 'SELLER_PAYABLE',
      debitPaise: 0,
      creditPaise: 5000,
      description: 'Order 2 earnings',
      createdAt: '2026-10-02T10:00:00Z',
    },
    // Refund on Order 2: Debited ₹20 (2000 paise)
    {
      id: 'e3',
      transactionId: 't3',
      sellerId,
      type: 'SELLER_PAYABLE',
      debitPaise: 2000,
      creditPaise: 0,
      description: 'Order 2 partial refund',
      createdAt: '2026-10-03T10:00:00Z',
    },
    // Payout: Disbursed ₹60 (6000 paise)
    {
      id: 'e4',
      transactionId: 't4',
      sellerId,
      type: 'SELLER_PAYOUT',
      debitPaise: 6000,
      creditPaise: 0,
      description: 'Bank transfer',
      createdAt: '2026-10-04T10:00:00Z',
    },
  ];

  const balance = calculateSellerBalance(sellerId, entries);
  // Total earned: 8000 + 5000 = 13000 paise (₹130)
  assert.equal(balance.totalEarningsPaise, 13000);
  // Refunded: 2000 paise (₹20)
  assert.equal(balance.refundedPaise, 2000);
  // Paid out: 6000 paise (₹60)
  assert.equal(balance.paidOutPaise, 6000);
  // Available remaining: 13000 - 2000 - 6000 = 5000 paise (₹50)
  assert.equal(balance.availablePaise, 5000);
});
