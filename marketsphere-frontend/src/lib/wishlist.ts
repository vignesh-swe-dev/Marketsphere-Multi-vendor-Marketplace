import { useState, useEffect } from 'react';
import type { Product } from '../types/index.ts';

const WISHLIST_KEY = 'marketsphere-wishlist';
const RECENTLY_VIEWED_KEY = 'marketsphere-recently-viewed';

export function getSavedWishlist(): string[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveWishlist(ids: string[]) {
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  } catch {}
}

export function getRecentlyViewed(): Product[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function addRecentlyViewed(product: Product) {
  try {
    const current = getRecentlyViewed();
    const filtered = current.filter((p) => p.id !== product.id);
    const updated = [product, ...filtered].slice(0, 8);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {}
}

export function useWishlist() {
  const [wishlistIds, setWishlistIds] = useState<string[]>(getSavedWishlist);

  const toggleWishlist = (productId: string) => {
    setWishlistIds((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      saveWishlist(next);
      return next;
    });
  };

  const isInWishlist = (productId: string) => wishlistIds.includes(productId);

  return { wishlistIds, toggleWishlist, isInWishlist };
}
