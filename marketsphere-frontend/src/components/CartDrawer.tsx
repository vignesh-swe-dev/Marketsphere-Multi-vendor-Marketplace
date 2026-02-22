import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  ShoppingBag, 
  Store, 
  ArrowRight, 
  Tag, 
  Truck, 
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Sparkles,
  ShieldCheck,
  Undo2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CartItem } from '../types/index.ts';
import { formatMoney } from '../lib/formatters.ts';
import { Button, IconButton, PriceTag, Badge, Drawer, EmptyState } from './ui/index.ts';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  couponCode: string;
  appliedDiscountCents: number;
  onUpdateQuantity: (cartItemId: string, newQty: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onApplyCoupon: (code: string) => Promise<boolean>;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  couponCode,
  appliedDiscountCents,
  onUpdateQuantity,
  onRemoveItem,
  onApplyCoupon,
  onProceedToCheckout,
}) => {
  const [inputCoupon, setInputCoupon] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [lastRemovedItem, setLastRemovedItem] = useState<{ item: CartItem; index: number } | null>(null);

  // Group items by vendor
  const sellerGroups: Record<string, { shopName: string; items: CartItem[]; subtotal: number }> = {};
  for (const item of items) {
    const sId = item.product.sellerId;
    if (!sellerGroups[sId]) {
      sellerGroups[sId] = {
        shopName: item.product.shopName || 'Boutique Merchant',
        items: [],
        subtotal: 0,
      };
    }
    const price = item.selectedVariant ? item.selectedVariant.pricePaise : item.product.basePricePaise;
    sellerGroups[sId].items.push(item);
    sellerGroups[sId].subtotal += price * item.quantity;
  }

  const sellerCount = Object.keys(sellerGroups).length;
  const itemsSubtotalCents = items.reduce((sum, it) => {
    const price = itemPrice(it);
    return sum + price * it.quantity;
  }, 0);

  function itemPrice(it: CartItem): number {
    return it.selectedVariant ? it.selectedVariant.pricePaise : it.product.basePricePaise;
  }

  // Flat shipping per seller package
  const shippingCents = sellerCount * 500;
  const estimatedTaxCents = Math.round(Math.max(0, itemsSubtotalCents - appliedDiscountCents) * 0.08);
  const totalCents = Math.max(0, itemsSubtotalCents - appliedDiscountCents + shippingCents + estimatedTaxCents);

  // Free shipping progress indicator target: 15000 minor units
  const freeShippingThreshold = 15000;
  const progressToFree = Math.min(100, Math.round((itemsSubtotalCents / freeShippingThreshold) * 100));
  const remainingForFree = Math.max(0, freeShippingThreshold - itemsSubtotalCents);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCoupon.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const ok = await onApplyCoupon(inputCoupon.trim());
      if (!ok) {
        setCouponError('Invalid or expired coupon code. Try WELCOME10 or SAVE25');
      } else {
        setInputCoupon('');
      }
    } catch {
      setCouponError('Error verifying coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveWithUndo = (cartItemId: string) => {
    const idx = items.findIndex((it) => it.id === cartItemId);
    const item = items[idx];
    if (item) {
      setLastRemovedItem({ item, index: idx });
      onRemoveItem(cartItemId);
    }
  };

  const handleUndoRemove = () => {
    if (lastRemovedItem) {
      onUpdateQuantity(lastRemovedItem.item.id, lastRemovedItem.item.quantity);
      setLastRemovedItem(null);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md sm:max-w-lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Your Cart
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {items.length} {items.length === 1 ? 'item' : 'items'} across {sellerCount} {sellerCount === 1 ? 'shop' : 'shops'}
            </p>
          </div>
        </div>
      }
      footer={
        items.length > 0 ? (
          <div className="space-y-4">
            {/* Calculations Breakdown */}
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200 font-mono">
                  {formatMoney(itemsSubtotalCents)}
                </span>
              </div>
              
              {appliedDiscountCents > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    Coupon ({couponCode})
                  </span>
                  <span className="font-mono">-{formatMoney(appliedDiscountCents)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  Vendor Shipping ({sellerCount} {sellerCount === 1 ? 'package' : 'packages'})
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-200 font-mono">
                  {formatMoney(shippingCents)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Estimated Sales Tax (8%)</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200 font-mono">
                  {formatMoney(estimatedTaxCents)}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-2.5 border-t border-slate-200 dark:border-slate-800 text-sm font-extrabold text-slate-900 dark:text-white">
                <div>
                  <span>Total Due</span>
                  <p className="text-[10px] text-slate-400 font-normal">Escrow protected checkout</p>
                </div>
                <span className="text-lg font-mono text-indigo-600 dark:text-indigo-400">
                  {formatMoney(totalCents)}
                </span>
              </div>
            </div>

            {/* Sticky Checkout CTA */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              shine
              onClick={() => {
                onClose();
                onProceedToCheckout();
              }}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Proceed to Multi-Vendor Checkout
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Independent seller fulfillment with atomic escrow protection</span>
            </div>
          </div>
        ) : undefined
      }
    >
      {/* Free Shipping Progress bar */}
      {items.length > 0 && (
        <div className="mb-6 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              {progressToFree >= 100 ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  Unlocked: Free platform express shipping!
                </span>
              ) : (
                <span>
                  Add <strong className="font-mono text-indigo-600 dark:text-indigo-300">{formatMoney(remainingForFree)}</strong> more for free bonus shipping
                </span>
              )}
            </span>
            <span className="font-mono font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
              {progressToFree}%
            </span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressToFree}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Undo Notification Pill */}
      <AnimatePresence>
        {lastRemovedItem && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 rounded-xl bg-slate-900 text-white dark:bg-slate-800 flex items-center justify-between text-xs shadow-md"
          >
            <span className="truncate pr-2">
              Removed <strong>{lastRemovedItem.item.product.name}</strong>
            </span>
            <button
              type="button"
              onClick={handleUndoRemove}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider text-[11px] shrink-0"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Content */}
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8 text-indigo-500" />}
          title="Your shopping cart is empty"
          description="Explore independent verified creators, authentic artisans, and boutique shops across MarketSphere."
          actionLabel="Start Exploring"
          onAction={onClose}
        />
      ) : (
        <div className="space-y-6">
          {/* Vendor Item Groups */}
          {Object.entries(sellerGroups).map(([sellerId, group]) => (
            <div
              key={sellerId}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3.5 shadow-xs"
            >
              {/* Vendor Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {group.shopName}
                  </span>
                </div>
                <Badge variant="neutral" size="sm" className="shrink-0 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-slate-400" />
                  {formatMoney(500)} Flat Delivery
                </Badge>
              </div>

              {/* Items in Vendor Package */}
              <div className="space-y-3">
                {group.items.map((item) => {
                  const price = itemPrice(item);
                  const image =
                    item.product.images?.[0] ||
                    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

                  return (
                    <div
                      key={item.id}
                      className="flex gap-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                    >
                      <img
                        src={image}
                        alt={item.product.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                        width={64}
                        height={64}
                        loading="lazy"
                      />

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {item.product.name}
                          </h4>
                          {item.selectedVariant && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Variant: <span className="font-semibold">{item.selectedVariant.name}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1">
                          <PriceTag priceCents={price * item.quantity} size="sm" />

                          <div className="flex items-center gap-2">
                            {/* Stepper with touch-friendly targets */}
                            <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                              <IconButton
                                variant="default"
                                size="sm"
                                aria-label="Decrease quantity"
                                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                className="w-7 h-7 min-w-[28px] min-h-[28px] text-slate-600 dark:text-slate-300"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </IconButton>

                              <span className="w-7 text-center font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                                {item.quantity}
                              </span>

                              <IconButton
                                variant="default"
                                size="sm"
                                aria-label="Increase quantity"
                                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                className="w-7 h-7 min-w-[28px] min-h-[28px] text-slate-600 dark:text-slate-300"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </IconButton>
                            </div>

                            {/* Trash action */}
                            <IconButton
                              variant="danger"
                              size="sm"
                              aria-label="Remove item"
                              onClick={() => handleRemoveWithUndo(item.id)}
                              className="w-7 h-7 min-w-[28px] min-h-[28px]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Coupon Code Section */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <form onSubmit={handleApply} className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Promo or Discount Code
              </label>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="E.g. WELCOME10, SAVE25"
                    value={inputCoupon}
                    onChange={(e) => {
                      setInputCoupon(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl uppercase font-mono tracking-wider text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                </div>
                
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  loading={couponLoading}
                  disabled={couponLoading || !inputCoupon.trim()}
                >
                  Apply
                </Button>
              </div>

              {couponCode && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Coupon <strong>{couponCode}</strong> applied (-{formatMoney(appliedDiscountCents)})
                  </span>
                </div>
              )}

              {couponError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 pt-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{couponError}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </Drawer>
  );
};
