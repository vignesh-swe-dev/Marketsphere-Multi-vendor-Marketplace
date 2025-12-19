/**
 * Payment Gateway Provider Abstraction and Sandbox Adapter.
 * Backed by MongoDB with multi-document transactions (sessions) and atomic inventory decrements.
 * Includes HMAC-SHA256 signature verification, idempotency tracking,
 * balanced ledger entries generation, and inventory commits.
 * All monetary amounts are stored in minor units: for INR that is paise (100 paise = ₹1).
 */

import crypto from 'node:crypto';
import {
  PaymentModel,
  OrderModel,
  SellerOrderModel,
  OrderItemModel,
  LedgerEntryModel,
  AuditLogModel,
  ProductVariantModel,
  InventoryModel,
} from './models/index.ts';
import { withTransaction } from './db.ts';
import { createOrderLedgerPostings, createRefundLedgerPostings } from './lib/ledger.ts';
import { calculateRefundReversal } from './lib/commission.ts';
import type { PaymentRecord, PaymentStatus } from './types/index.ts';

export interface PaymentSessionResult {
  sessionId: string;
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
  clientSecret: string;
  status: PaymentStatus;
  // Backward compatibility alias
  amountCents?: number;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: 'payment.succeeded' | 'payment.failed' | 'refund.processed';
  providerPaymentId: string;
  orderId: string;
  amountPaise: number;
  amountCents?: number;
  timestamp: string;
}

const SANDBOX_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'mk_whsec_sandbox_892401824709';

export class PaymentGatewayService {
  /**
   * Generates a deterministic HMAC SHA-256 signature for signed webhook testing.
   */
  public static generateSignature(payloadString: string, secret = SANDBOX_WEBHOOK_SECRET): string {
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  /**
   * Verifies an incoming webhook signature using timing-safe comparison.
   */
  public static verifySignature(payloadString: string, signature: string, secret = SANDBOX_WEBHOOK_SECRET): boolean {
    try {
      const expected = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /**
   * Initiates a payment session for an order.
   */
  public static async createPaymentSession(params: {
    orderId: string;
    amountPaise?: number;
    amountCents?: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<PaymentSessionResult> {
    const amountPaise = params.amountPaise ?? params.amountCents ?? 0;
    const { orderId, currency, idempotencyKey } = params;

    // Check for existing payment with this idempotency key
    const existing = await PaymentModel.findOne({ idempotencyKey });
    if (existing) {
      return {
        sessionId: `sess_${existing.id}`,
        providerPaymentId: existing.providerPaymentId,
        amountPaise: existing.amountPaise,
        amountCents: existing.amountPaise,
        currency: existing.currency,
        clientSecret: `sec_${existing.id}_live_sandbox`,
        status: existing.status,
      };
    }

    const paymentId = `pay_${crypto.randomUUID()}`;
    const providerPaymentId = `sbx_pi_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    await PaymentModel.create({
      _id: paymentId,
      orderId,
      provider: 'SANDBOX',
      providerPaymentId,
      amountPaise,
      currency,
      status: 'INITIATED',
      idempotencyKey,
      signatureVerified: true,
      rawPayload: { initiatedVia: 'MarketSphere Sandbox Checkout Adapter' },
    });

    return {
      sessionId: `sess_${paymentId}`,
      providerPaymentId,
      amountPaise,
      amountCents: amountPaise,
      currency,
      clientSecret: `sec_${paymentId}_live_sandbox`,
      status: 'INITIATED',
    };
  }

  /**
   * Processes a verified payment success event using a MongoDB multi-document transaction.
   * Updates order, performs atomic inventory decrement, and writes balanced double-entry ledger postings.
   */
  public static async handlePaymentSuccess(
    providerPaymentId: string,
    orderId: string
  ): Promise<{ success: boolean; message: string }> {
    return await withTransaction(async (session) => {
      const order = await OrderModel.findById(orderId).session(session);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.status === 'PAID' || order.status === 'PROCESSING') {
        return { success: true, message: 'Order was already processed (idempotent duplicate event)' };
      }

      const now = new Date();

      // 1. Update Payment status
      await PaymentModel.updateOne(
        { providerPaymentId },
        { $set: { status: 'CAPTURED' } },
        { session: session ?? undefined }
      );

      // 2. Update Order status
      order.status = 'PROCESSING';
      order.paymentId = providerPaymentId;
      await order.save({ session });

      // 3. Update Seller Suborders
      await SellerOrderModel.updateMany(
        { parentOrderId: orderId },
        { $set: { status: 'PROCESSING' } },
        { session: session ?? undefined }
      );

      // 4. Fetch all seller suborders to create balanced ledger postings
      const sellerOrders = await SellerOrderModel.find({ parentOrderId: orderId }).session(session);
      const txId = `tx_${orderId}_${Date.now()}`;

      for (const sOrder of sellerOrders) {
        const postings = createOrderLedgerPostings({
          orderId,
          sellerId: sOrder.sellerId,
          grossPaise: sOrder.totalPaise,
          sellerPayablePaise: sOrder.sellerNetPayablePaise,
          commissionPaise: sOrder.commissionTotalPaise,
          taxPaise: sOrder.taxPaise,
          shippingPaise: sOrder.shippingPaise,
        });

        for (const p of postings) {
          await LedgerEntryModel.create(
            [
              {
                _id: `led_${crypto.randomUUID()}`,
                transactionId: txId,
                sellerId: p.sellerId,
                orderId: p.orderId,
                type: p.type,
                debitPaise: p.debitPaise,
                creditPaise: p.creditPaise,
                description: p.description,
                createdAt: now,
              },
            ],
            { session }
          );
        }

        // 5. Atomic decrement of inventory
        const items = await OrderItemModel.find({ sellerOrderId: sOrder.id }).session(session);
        for (const it of items) {
          if (it.variantId) {
            // Atomic decrement: only succeeds if enough stock is left. If another customer bought the
            // last units first, this fails and the whole transaction (including the payment) is rolled back.
            const updated = await ProductVariantModel.findOneAndUpdate(
              { _id: it.variantId, inventoryQuantity: { $gte: it.quantity } },
              { $inc: { inventoryQuantity: -it.quantity } },
              { session: session ?? undefined }
            );
            if (!updated) {
              throw new Error(`Insufficient stock for ${(it as any).productName || 'an item'}. You were not charged.`);
            }

            await InventoryModel.findOneAndUpdate(
              { stockItemId: it.variantId, totalQuantity: { $gte: it.quantity } },
              { $inc: { totalQuantity: -it.quantity } },
              { session: session ?? undefined }
            );
          }
        }
      }

      // 6. Record Audit Log
      await AuditLogModel.create(
        [
          {
            _id: `audit_${crypto.randomUUID()}`,
            actorId: order.customerId,
            actorRole: 'CUSTOMER',
            action: 'PAYMENT_CAPTURED_AND_VERIFIED',
            targetType: 'ORDER',
            targetId: orderId,
            details: { providerPaymentId, totalPaise: order.totalPaise, txId },
            timestamp: now,
          },
        ],
        { session: session ?? undefined }
      );

      return { success: true, message: 'Payment captured and ledger entries created successfully' };
    });
  }

  /**
   * Processes a refund: calculates reversal split, adjusts order status, and posts compensating ledger entries.
   * Executes in a MongoDB multi-document transaction.
   */
  public static async processRefund(params: {
    orderId: string;
    sellerOrderId?: string;
    amountPaise?: number;
    amountCents?: number;
    reason: string;
    actorId: string;
    actorRole: 'ADMIN' | 'SUPPORT';
  }): Promise<{ success: boolean; refundId: string; amountRefundedPaise: number; amountRefundedCents: number }> {
    const amountPaise = params.amountPaise ?? params.amountCents ?? 0;
    const { orderId, sellerOrderId, reason, actorId, actorRole } = params;

    return await withTransaction(async (session) => {
      const order = await OrderModel.findById(orderId).session(session);
      if (!order) throw new Error('Order not found');

      const refundId = `ref_${crypto.randomUUID()}`;
      const now = new Date();

      const sellerOrders = sellerOrderId
        ? await SellerOrderModel.find({ _id: sellerOrderId }).session(session)
        : await SellerOrderModel.find({ parentOrderId: orderId }).session(session);

      if (sellerOrders.length === 0) throw new Error('No matching seller suborders found');

      const totalEligible = sellerOrders.reduce((sum, so) => sum + so.totalPaise, 0);
      const effectiveRefund = Math.min(amountPaise, totalEligible);
      const txId = `tx_refund_${refundId}`;

      for (const sOrder of sellerOrders) {
        const share = Math.round((sOrder.totalPaise / totalEligible) * effectiveRefund);
        if (share <= 0) continue;

        const items = await OrderItemModel.find({ sellerOrderId: sOrder.id }).session(session);
        let totalItemCommission = 0;
        let totalItemSellerPayable = 0;
        let totalItemGross = 0;

        for (const it of items) {
          totalItemGross += it.totalPaise - it.allocatedDiscountPaise;
          totalItemCommission += it.commissionAmountPaise;
          totalItemSellerPayable += it.sellerPayablePaise;
        }

        const reversal = calculateRefundReversal(
          {
            grossMerchandisePaise: totalItemGross,
            allocatedDiscountPaise: 0,
            commissionBasePaise: totalItemGross,
            commissionRate: totalItemGross > 0 ? totalItemCommission / totalItemGross : 0.1,
            commissionAmountPaise: totalItemCommission,
            sellerPayablePaise: totalItemSellerPayable,
          },
          share
        );

        const postings = createRefundLedgerPostings({
          orderId,
          sellerId: sOrder.sellerId,
          refundMerchandisePaise: reversal.refundMerchandisePaise,
          sellerDeductionPaise: reversal.sellerDeductionPaise,
          commissionReversalPaise: reversal.commissionReversalPaise,
        });

        for (const p of postings) {
          await LedgerEntryModel.create(
            [
              {
                _id: `led_${crypto.randomUUID()}`,
                transactionId: txId,
                sellerId: p.sellerId,
                orderId: p.orderId,
                type: p.type,
                debitPaise: p.debitPaise,
                creditPaise: p.creditPaise,
                description: p.description,
                createdAt: now,
              },
            ],
            { session }
          );
        }

        // Update suborder status
        sOrder.status = 'REFUNDED';
        await sOrder.save({ session });
      }

      // Update parent order status
      order.status = 'REFUNDED';
      await order.save({ session });

      // Record Audit Log
      await AuditLogModel.create(
        [
          {
            _id: `audit_${crypto.randomUUID()}`,
            actorId,
            actorRole,
            action: 'PROCESS_REFUND',
            targetType: 'ORDER',
            targetId: orderId,
            details: { refundId, amountRefundedPaise: effectiveRefund, reason, txId },
            timestamp: now,
          },
        ],
        { session: session ?? undefined }
      );

      return {
        success: true,
        refundId,
        amountRefundedPaise: effectiveRefund,
        amountRefundedCents: effectiveRefund,
      };
    });
  }
}
