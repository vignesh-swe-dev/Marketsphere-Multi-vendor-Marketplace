/**
 * Append-only Financial Ledger Engine for MarketSphere
 * Implements double-entry / balanced transaction accounting rules:
 * - Historical ledger entries are immutable (no UPDATE/DELETE).
 * - Errors or adjustments are recorded strictly as compensating entries.
 * - Transactions must balance (debits == credits).
 * All monetary amounts are stored in integer minor units (paise).
 */

import type { LedgerEntry, LedgerEntryType, LedgerBalance } from '../types/index.ts';

export interface LedgerPosting {
  sellerId?: string;
  orderId?: string;
  type: LedgerEntryType;
  debitPaise: number;
  creditPaise: number;
  description: string;
  // Aliases for compatibility
  debitCents?: number;
  creditCents?: number;
}

export interface BalancedTransaction {
  transactionId: string;
  orderId?: string;
  sellerId?: string;
  postings: LedgerPosting[];
}

/**
 * Validates that all postings in a transaction balance exactly (Total Debits == Total Credits).
 */
export function validateTransactionBalance(postings: LedgerPosting[]): {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
} {
  const totalDebits = postings.reduce((sum, p) => sum + (p.debitPaise ?? p.debitCents ?? 0), 0);
  const totalCredits = postings.reduce((sum, p) => sum + (p.creditPaise ?? p.creditCents ?? 0), 0);
  return {
    isBalanced: totalDebits === totalCredits,
    totalDebits,
    totalCredits,
    difference: totalDebits - totalCredits,
  };
}

/**
 * Creates balanced postings for a customer order purchase.
 * Debit: Customer payment (Cash/Receivable from Payment Gateway)
 * Credit: Seller Payable + Marketplace Commission + Tax + Shipping
 */
export function createOrderLedgerPostings(params: {
  orderId: string;
  sellerId: string;
  grossPaise?: number;
  sellerPayablePaise?: number;
  commissionPaise?: number;
  taxPaise?: number;
  shippingPaise?: number;
  // Aliases
  grossCents?: number;
  sellerPayableCents?: number;
  commissionCents?: number;
  taxCents?: number;
  shippingCents?: number;
}): LedgerPosting[] {
  const orderId = params.orderId;
  const sellerId = params.sellerId;
  const grossPaise = params.grossPaise ?? params.grossCents ?? 0;
  const sellerPayablePaise = params.sellerPayablePaise ?? params.sellerPayableCents ?? 0;
  const commissionPaise = params.commissionPaise ?? params.commissionCents ?? 0;
  const taxPaise = params.taxPaise ?? params.taxCents ?? 0;
  const shippingPaise = params.shippingPaise ?? params.shippingCents ?? 0;

  // The customer pays the total gross amount
  const customerPaymentPosting: LedgerPosting = {
    orderId,
    sellerId,
    type: 'GROSS_SALE',
    debitPaise: grossPaise,
    creditPaise: 0,
    debitCents: grossPaise,
    creditCents: 0,
    description: `Customer payment received for order ${orderId}`,
  };

  const sellerPayablePosting: LedgerPosting = {
    orderId,
    sellerId,
    type: 'SELLER_PAYABLE',
    debitPaise: 0,
    creditPaise: sellerPayablePaise,
    debitCents: 0,
    creditCents: sellerPayablePaise,
    description: `Seller net earnings allocated for order ${orderId}`,
  };

  const commissionPosting: LedgerPosting = {
    orderId,
    sellerId,
    type: 'MARKETPLACE_COMMISSION',
    debitPaise: 0,
    creditPaise: commissionPaise,
    debitCents: 0,
    creditCents: commissionPaise,
    description: `Marketplace platform commission for order ${orderId}`,
  };

  const postings: LedgerPosting[] = [customerPaymentPosting, sellerPayablePosting, commissionPosting];

  if (taxPaise > 0) {
    postings.push({
      orderId,
      sellerId,
      type: 'TAX_COLLECTED',
      debitPaise: 0,
      creditPaise: taxPaise,
      debitCents: 0,
      creditCents: taxPaise,
      description: `GST liability held for government remittance for order ${orderId}`,
    });
  }

  if (shippingPaise > 0) {
    postings.push({
      orderId,
      sellerId,
      type: 'SHIPPING_COLLECTED',
      debitPaise: 0,
      creditPaise: shippingPaise,
      debitCents: 0,
      creditCents: shippingPaise,
      description: `Shipping fulfillment fee collected for order ${orderId}`,
    });
  }

  return postings;
}

/**
 * Creates balanced compensating postings for a refund.
 */
export function createRefundLedgerPostings(params: {
  orderId: string;
  sellerId: string;
  refundMerchandisePaise?: number;
  sellerDeductionPaise?: number;
  commissionReversalPaise?: number;
  // Aliases
  refundMerchandiseCents?: number;
  sellerDeductionCents?: number;
  commissionReversalCents?: number;
}): LedgerPosting[] {
  const orderId = params.orderId;
  const sellerId = params.sellerId;
  const refundMerchandisePaise = params.refundMerchandisePaise ?? params.refundMerchandiseCents ?? 0;
  const sellerDeductionPaise = params.sellerDeductionPaise ?? params.sellerDeductionCents ?? 0;
  const commissionReversalPaise = params.commissionReversalPaise ?? params.commissionReversalCents ?? 0;

  return [
    {
      orderId,
      sellerId,
      type: 'REFUND_MERCHANDISE',
      debitPaise: 0,
      creditPaise: refundMerchandisePaise,
      debitCents: 0,
      creditCents: refundMerchandisePaise,
      description: `Customer refund disbursed for order ${orderId}`,
    },
    {
      orderId,
      sellerId,
      type: 'SELLER_PAYABLE',
      debitPaise: sellerDeductionPaise,
      creditPaise: 0,
      debitCents: sellerDeductionPaise,
      creditCents: 0,
      description: `Seller balance debited for refund on order ${orderId}`,
    },
    {
      orderId,
      sellerId,
      type: 'REFUND_COMMISSION_REVERSAL',
      debitPaise: commissionReversalPaise,
      creditPaise: 0,
      debitCents: commissionReversalPaise,
      creditCents: 0,
      description: `Marketplace commission clawed back for refund on order ${orderId}`,
    },
  ];
}

/**
 * Calculates current seller balances from ledger entries.
 */
export function calculateSellerBalance(
  sellerId: string,
  entries: (LedgerEntry | any)[]
): LedgerBalance & {
  pendingCents?: number;
  availableCents?: number;
  paidOutCents?: number;
  refundedCents?: number;
  totalEarningsCents?: number;
} {
  let pendingPaise = 0;
  let availablePaise = 0;
  let paidOutPaise = 0;
  let refundedPaise = 0;
  let totalEarningsPaise = 0;

  for (const entry of entries) {
    const entrySellerId = entry.sellerId || entry.seller_id;
    if (entrySellerId !== sellerId) continue;

    const credit =
      entry.creditPaise ??
      entry.credit_paise ??
      entry.creditCents ??
      entry.credit_cents ??
      0;
    const debit =
      entry.debitPaise ??
      entry.debit_paise ??
      entry.debitCents ??
      entry.debit_cents ??
      0;

    switch (entry.type) {
      case 'SELLER_PAYABLE':
        // Credit increases seller earnings; debit decreases (e.g. on refund)
        if (credit > 0) {
          totalEarningsPaise += credit;
          availablePaise += credit;
        }
        if (debit > 0) {
          availablePaise -= debit;
          refundedPaise += debit;
        }
        break;

      case 'SELLER_PAYOUT':
        // Seller payout debits their available balance
        paidOutPaise += debit;
        availablePaise -= debit;
        break;

      default:
        break;
    }
  }

  const result = {
    sellerId,
    pendingPaise: Math.max(0, pendingPaise),
    availablePaise: Math.max(0, availablePaise),
    paidOutPaise,
    refundedPaise,
    totalEarningsPaise,
    // Aliases
    pendingCents: Math.max(0, pendingPaise),
    availableCents: Math.max(0, availablePaise),
    paidOutCents: paidOutPaise,
    refundedCents: refundedPaise,
    totalEarningsCents: totalEarningsPaise,
  };

  return result;
}
