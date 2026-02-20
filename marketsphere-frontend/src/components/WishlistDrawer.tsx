import React from 'react';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import type { Product } from '../types/index.ts';
import { formatMoney } from '../lib/formatters.ts';
import { Drawer, Button, IconButton, EmptyState } from './ui/index.ts';

export interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistProducts: Product[];
  onRemoveFromWishlist: (productId: string) => void;
  onAddToCart: (product: Product) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  wishlistProducts,
  onRemoveFromWishlist,
  onAddToCart,
}) => {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          <span>Saved Wishlist ({wishlistProducts.length})</span>
        </div>
      }
      description="Items you have bookmarked for later"
      maxWidth="max-w-md"
    >
      {wishlistProducts.length === 0 ? (
        <EmptyState
          icon={<Heart className="w-8 h-8 text-rose-400" />}
          title="Your wishlist is empty"
          description="Click the heart icon on any product card while browsing to save items here."
          actionLabel="Explore Marketplace"
          onAction={onClose}
        />
      ) : (
        <div className="space-y-3.5">
          {wishlistProducts.map((p) => (
            <div
              key={p.id}
              className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={p.images?.[0] || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800'}
                  alt={p.name}
                  className="w-14 h-14 rounded-xl object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                  width={56}
                  height={56}
                  loading="lazy"
                />
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                    {p.name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{p.shopName}</p>
                  <p className="font-mono font-bold text-xs text-slate-900 dark:text-white mt-1">
                    {formatMoney(p.basePricePaise)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onAddToCart(p);
                    onRemoveFromWishlist(p.id);
                  }}
                  leftIcon={<ShoppingBag className="w-3.5 h-3.5" />}
                >
                  Move to Cart
                </Button>
                <IconButton
                  variant="default"
                  size="sm"
                  aria-label="Remove item from wishlist"
                  title="Remove from wishlist"
                  onClick={() => onRemoveFromWishlist(p.id)}
                  className="w-8 h-8 min-w-[32px] min-h-[32px] text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
};
