/**
 * Inventory Reservation and Concurrency Manager
 * Prevents overselling during checkout spikes by holding temporary stock locks
 * with automatic expiration and atomic commit/release semantics.
 */

export interface StockItem {
  id: string; // sku or variantId
  totalQuantity: number;
}

export interface InventoryReservation {
  id: string;
  orderOrCheckoutId: string;
  stockItemId: string;
  quantity: number;
  status: 'ACTIVE' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  createdAt: number; // timestamp ms
  expiresAt: number; // timestamp ms
}

export class InventoryManager {
  private stock = new Map<string, number>();
  private reservations = new Map<string, InventoryReservation>();
  private readonly defaultTtlMs: number;

  constructor(initialStock: Record<string, number> = {}, defaultTtlMs = 15 * 60 * 1000) {
    for (const [id, qty] of Object.entries(initialStock)) {
      this.stock.set(id, qty);
    }
    this.defaultTtlMs = defaultTtlMs;
  }

  public getAvailableStock(stockItemId: string, now = Date.now()): number {
    const total = this.stock.get(stockItemId) || 0;
    let activeReserved = 0;

    for (const res of this.reservations.values()) {
      if (res.stockItemId === stockItemId && res.status === 'ACTIVE') {
        if (now < res.expiresAt) {
          activeReserved += res.quantity;
        } else {
          // Lazy expire
          res.status = 'EXPIRED';
        }
      }
    }

    return Math.max(0, total - activeReserved);
  }

  public reserveStock(params: {
    reservationId: string;
    orderOrCheckoutId: string;
    items: { stockItemId: string; quantity: number }[];
    now?: number;
    ttlMs?: number;
  }): { success: boolean; error?: string } {
    const now = params.now ?? Date.now();
    const ttl = params.ttlMs ?? this.defaultTtlMs;
    const expiresAt = now + ttl;

    // Check availability for all items first (all-or-nothing check)
    for (const item of params.items) {
      const available = this.getAvailableStock(item.stockItemId, now);
      if (available < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for item ${item.stockItemId}. Requested: ${item.quantity}, Available: ${available}`,
        };
      }
    }

    // Atomically create reservations
    for (const item of params.items) {
      const id = `${params.reservationId}-${item.stockItemId}`;
      this.reservations.set(id, {
        id,
        orderOrCheckoutId: params.orderOrCheckoutId,
        stockItemId: item.stockItemId,
        quantity: item.quantity,
        status: 'ACTIVE',
        createdAt: now,
        expiresAt,
      });
    }

    return { success: true };
  }

  public commitReservation(orderOrCheckoutId: string): boolean {
    let anyCommitted = false;
    for (const res of this.reservations.values()) {
      if (res.orderOrCheckoutId === orderOrCheckoutId && res.status === 'ACTIVE') {
        const currentStock = this.stock.get(res.stockItemId) || 0;
        this.stock.set(res.stockItemId, Math.max(0, currentStock - res.quantity));
        res.status = 'COMMITTED';
        anyCommitted = true;
      }
    }
    return anyCommitted;
  }

  public releaseReservation(orderOrCheckoutId: string): boolean {
    let anyReleased = false;
    for (const res of this.reservations.values()) {
      if (res.orderOrCheckoutId === orderOrCheckoutId && res.status === 'ACTIVE') {
        res.status = 'RELEASED';
        anyReleased = true;
      }
    }
    return anyReleased;
  }

  public restock(stockItemId: string, quantity: number): number {
    const current = this.stock.get(stockItemId) || 0;
    const updated = current + quantity;
    this.stock.set(stockItemId, updated);
    return updated;
  }
}
