/**
 * Cart line validation shared by checkout quote and order creation.
 * The browser only sends productId, variantId and quantity. Everything else (price, stock,
 * availability) is decided here on the server from the database.
 */
import type { ClientSession } from 'mongoose';
import { ProductVariantModel } from '../models/index.ts';

export const MAX_QUANTITY_PER_LINE = 50;

export class CartError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'CartError';
    this.status = status;
    this.code = code;
  }
}

export function parseQuantity(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_QUANTITY_PER_LINE) {
    throw new CartError(400, 'INVALID_QUANTITY', `Quantity must be a whole number from 1 to ${MAX_QUANTITY_PER_LINE}`);
  }
  return n;
}

export interface ResolvedCartLine {
  quantity: number;
  variantId: string | null;
  variantName?: string;
  sku: string;
  unitPricePaise: number;
}

export async function resolveCartLine(
  product: { id: string; name: string; status: string; sku: string; basePricePaise: number },
  item: { variantId?: string; quantity?: unknown },
  session?: ClientSession | null
): Promise<ResolvedCartLine> {
  if (product.status !== 'PUBLISHED') {
    throw new CartError(400, 'PRODUCT_UNAVAILABLE', `${product.name} is not available for purchase`);
  }

  const quantity = parseQuantity(item.quantity);

  const variants = await ProductVariantModel.find({ productId: product.id }).session(session ?? null);

  let variant = null;
  if (item.variantId) {
    // The variant must belong to this exact product, otherwise a cheap variant could be applied to an expensive product
    variant = variants.find((v) => v.id === item.variantId) ?? null;
    if (!variant) {
      throw new CartError(400, 'INVALID_VARIANT', `The selected option does not exist for ${product.name}`);
    }
  } else if (variants.length === 1) {
    variant = variants[0];
  } else if (variants.length > 1) {
    throw new CartError(400, 'VARIANT_REQUIRED', `Please choose an option for ${product.name}`);
  }

  if (variant && variant.inventoryQuantity < quantity) {
    const left = Math.max(0, variant.inventoryQuantity);
    throw new CartError(
      400,
      'INSUFFICIENT_INVENTORY',
      `Insufficient stock for ${product.name}${variant.name ? ` (${variant.name})` : ''}. ${left === 0 ? 'Out of stock.' : `Only ${left} left.`}`
    );
  }

  return {
    quantity,
    variantId: variant ? variant.id : null,
    variantName: variant?.name,
    sku: variant ? variant.sku : product.sku,
    unitPricePaise: variant ? variant.pricePaise : product.basePricePaise,
  };
}

/**
 * Combine lines for the same product option so stock is checked against the TOTAL asked for.
 * Without this, three lines of 50 units each would pass a per-line check against 120 in stock.
 */
export function mergeCartItems<T extends { productId?: string; variantId?: string; quantity?: unknown }>(
  items: T[]
): Array<{ productId: string; variantId?: string; quantity: number }> {
  const merged = new Map<string, { productId: string; variantId?: string; quantity: number }>();
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !item.productId) {
      throw new CartError(400, 'INVALID_PRODUCT', 'Every cart item needs a productId');
    }
    const quantity = parseQuantity(item.quantity);
    const key = `${item.productId}|${item.variantId ?? ''}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > MAX_QUANTITY_PER_LINE) {
        throw new CartError(400, 'INVALID_QUANTITY', `You can buy at most ${MAX_QUANTITY_PER_LINE} of one item per order`);
      }
    } else {
      merged.set(key, { productId: item.productId, variantId: item.variantId || undefined, quantity });
    }
  }
  return [...merged.values()];
}
