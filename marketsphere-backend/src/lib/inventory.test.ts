import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryManager } from './inventory.ts';

test('Inventory reservation prevents overselling under concurrent checkouts', () => {
  const manager = new InventoryManager({ 'sku-macbook': 2 });

  // Customer A reserves 2 items
  const resA = manager.reserveStock({
    reservationId: 'res-A',
    orderOrCheckoutId: 'checkout-A',
    items: [{ stockItemId: 'sku-macbook', quantity: 2 }],
  });
  assert.equal(resA.success, true);
  assert.equal(manager.getAvailableStock('sku-macbook'), 0);

  // Customer B tries to reserve 1 item concurrently
  const resB = manager.reserveStock({
    reservationId: 'res-B',
    orderOrCheckoutId: 'checkout-B',
    items: [{ stockItemId: 'sku-macbook', quantity: 1 }],
  });
  assert.equal(resB.success, false, 'Should reject reservation when stock is locked');
  assert.match(resB.error ?? '', /Insufficient stock/);
});

test('Committed reservation permanently decrements stock', () => {
  const manager = new InventoryManager({ 'sku-chair': 5 });

  manager.reserveStock({
    reservationId: 'res-1',
    orderOrCheckoutId: 'checkout-1',
    items: [{ stockItemId: 'sku-chair', quantity: 2 }],
  });

  const committed = manager.commitReservation('checkout-1');
  assert.equal(committed, true);
  // Total stock is now 3, with 0 active reservations -> available is 3
  assert.equal(manager.getAvailableStock('sku-chair'), 3);
});

test('Released reservation restores available stock immediately', () => {
  const manager = new InventoryManager({ 'sku-headphones': 10 });

  manager.reserveStock({
    reservationId: 'res-cart',
    orderOrCheckoutId: 'checkout-cart',
    items: [{ stockItemId: 'sku-headphones', quantity: 4 }],
  });
  assert.equal(manager.getAvailableStock('sku-headphones'), 6);

  manager.releaseReservation('checkout-cart');
  assert.equal(manager.getAvailableStock('sku-headphones'), 10, 'Full stock restored on release');
});

test('Expired reservations are automatically ignored', () => {
  const now = 1000000;
  const ttl = 60000; // 1 min
  const manager = new InventoryManager({ 'sku-watch': 3 });

  manager.reserveStock({
    reservationId: 'res-exp',
    orderOrCheckoutId: 'checkout-exp',
    items: [{ stockItemId: 'sku-watch', quantity: 3 }],
    now,
    ttlMs: ttl,
  });

  // During reservation window: 0 available
  assert.equal(manager.getAvailableStock('sku-watch', now + 1000), 0);

  // After expiration: 3 available
  assert.equal(manager.getAvailableStock('sku-watch', now + ttl + 1000), 3);
});
