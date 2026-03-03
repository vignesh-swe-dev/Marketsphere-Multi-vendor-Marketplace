import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Store, 
  ArrowRight, 
  ShieldCheck, 
  Truck, 
  Sparkles, 
  SlidersHorizontal,
  ChevronRight,
  Plus,
  Check,
  Heart,
  RotateCcw,
  CreditCard,
  X,
  Zap,
  ShoppingBag,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Product, Category } from '../types/index.ts';
import { formatMoney } from '../lib/formatters.ts';
import { 
  Button, 
  IconButton, 
  Badge, 
  Chip, 
  EmptyState, 
  Drawer, 
  PriceTag, 
  StarRating, 
  Skeleton 
} from './ui/index.ts';
import { getRecentlyViewed } from '../lib/wishlist.ts';

export interface StorefrontProps {
  products: Product[];
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (slug: string | null) => void;
  onOpenProduct: (product: Product) => void;
  onOpenShop: (shopSlug: string) => void;
  onAddToCart: (product: Product, variantId?: string) => void;
  onOpenSellerApply?: () => void;
  wishlistIds?: string[];
  onToggleWishlist?: (productId: string) => void;
  isLoading?: boolean;
}

export const Storefront: React.FC<StorefrontProps> = ({
  products,
  categories,
  selectedCategory,
  onSelectCategory,
  onOpenProduct,
  onOpenShop,
  onAddToCart,
  onOpenSellerApply,
  wishlistIds = [],
  onToggleWishlist,
  isLoading = false,
}) => {
  const [sortOption, setSortOption] = useState<'newest' | 'price_asc' | 'price_desc' | 'rating'>('newest');
  const [maxPrice, setMaxPrice] = useState<number>(5000000); // ₹50,000.00
  const [minRating, setMinRating] = useState<number>(0);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [addedItemMap, setAddedItemMap] = useState<Record<string, boolean>>({});
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if ((product.inventoryTotal ?? 1) <= 0) return;
    // Prefer an option that is in stock
    const defaultVariant = (product.variants?.find((v) => v.inventoryQuantity > 0) ?? product.variants?.[0])?.id;
    onAddToCart(product, defaultVariant);

    setAddedItemMap((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItemMap((prev) => ({ ...prev, [product.id]: false }));
    }, 1500);
  };

  const handleHeartClick = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWishlist?.(productId);
  };

  const filteredProducts = products
    .filter((p) => {
      if (selectedCategory && p.categoryId !== selectedCategory && p.categoryName !== selectedCategory) {
        return false;
      }
      if (p.basePricePaise > maxPrice) return false;
      if (minRating > 0 && p.rating < minRating) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOption === 'price_asc') return a.basePricePaise - b.basePricePaise;
      if (sortOption === 'price_desc') return b.basePricePaise - a.basePricePaise;
      if (sortOption === 'rating') return b.rating - a.rating;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const categoryIcons: Record<string, string> = {
    'cat-electronics': '⚡',
    'cat-home': '🏡',
    'cat-apparel': '✨',
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 text-white p-8 md:p-14 shadow-2xl border border-indigo-900/40">
        {/* Soft floating blurred shapes */}
        <div className="absolute top-10 right-12 w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-6 left-1/3 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl animate-float-delayed pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>Curated Multi-Vendor Marketplace</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Discover artisanal craft & precision technology.
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
            Order seamlessly from independent makers, verified hardware studios, and boutique home designers in one unified cart with transparent vendor fulfillment.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              shine
              onClick={() => {
                const el = document.getElementById('catalog-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Shop Now
            </Button>

            {onOpenSellerApply && (
              <Button
                variant="secondary"
                size="lg"
                onClick={onOpenSellerApply}
                leftIcon={<Store className="w-4 h-4 text-indigo-500" />}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40"
              >
                Become a Seller
              </Button>
            )}
          </div>

          {/* Trust Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">Verified Independent Sellers</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-medium">Secure Multi-Seller Escrow</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-violet-400 shrink-0" />
              <span className="font-medium">Easy 30-Day Guaranteed Refunds</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Verified Shops Row */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Featured Verified Shops
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Top-rated independent merchants with verified business legal identity
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Shop Card 1 */}
          <div 
            onClick={() => onOpenShop('apex-electronics')}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start gap-4">
              <img
                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200"
                alt="Apex Electronics"
                className="w-14 h-14 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shadow-sm shrink-0"
                width={56}
                height={56}
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                    Apex Electronics
                  </h3>
                  <Badge variant="success" size="sm">VIP Vendor</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  Next-generation beryllium audio hardware, custom CNC mechanical keyboards & GaN charging.
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    4.9 (142 reviews)
                  </span>
                  <span>•</span>
                  <span>Ships in 24 hrs</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
            </div>
          </div>

          {/* Shop Card 2 */}
          <div 
            onClick={() => onOpenShop('lumina-living')}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start gap-4">
              <img
                src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200"
                alt="Lumina Living"
                className="w-14 h-14 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shadow-sm shrink-0"
                width={56}
                height={56}
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                    Lumina Living Studio
                  </h3>
                  <Badge variant="primary" size="sm">Design Studio</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  Handcrafted solid walnut lighting, mouth-blown opal glass & natural merino wool workspace decor.
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    4.8 (89 reviews)
                  </span>
                  <span>•</span>
                  <span>Sustainable Craft</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section id="catalog-section" className="space-y-6 pt-4">
        {/* Header & Filter Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Marketplace Catalog
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Showing {filteredProducts.length} published products ready for dispatch
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mobile Filter Sheet Trigger */}
            <div className="sm:hidden">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsFilterSheetOpen(true)}
                leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
              >
                Filters
              </Button>
            </div>

            {/* Desktop Filters */}
            <div className="hidden sm:flex items-center gap-3">
              {/* Sort Selector */}
              <div className="relative flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl px-3 py-2 transition-colors shadow-2xs">
                <span className="font-semibold text-slate-400 select-none">Sort:</span>
                <div className="relative flex items-center">
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as any)}
                    className="bg-transparent font-medium border-0 border-none outline-none focus:outline-none focus:ring-0 cursor-pointer text-slate-800 dark:text-slate-100 appearance-none pr-5 py-0 pl-0 leading-tight select-none"
                    aria-label="Sort products"
                  >
                    <option value="newest" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Newest Arrivals</option>
                    <option value="price_asc" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Price: Low to High</option>
                    <option value="price_desc" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Price: High to Low</option>
                    <option value="rating" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Top Rated</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-0 shrink-0" />
                </div>
              </div>

              {/* Price Filter Slider */}
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                <span className="font-semibold text-slate-400">Max:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                  {formatMoney(maxPrice)}
                </span>
                <input
                  type="range"
                  min="50000"
                  max="5000000"
                  step="50000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-24 accent-indigo-600 cursor-pointer"
                />
              </div>

              {(selectedCategory !== null || maxPrice < 5000000 || minRating > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSelectCategory(null);
                    setMaxPrice(5000000);
                    setMinRating(0);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Category Chips Row (Scrollable on mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Chip
            active={selectedCategory === null}
            onClick={() => onSelectCategory(null)}
          >
            All Collections
          </Chip>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.slug || selectedCategory === cat.id;
            return (
              <Chip
                key={cat.id}
                active={isSelected}
                onClick={() => onSelectCategory(cat.id)}
                icon={categoryIcons[cat.id] ? <span>{categoryIcons[cat.id]}</span> : undefined}
              >
                {cat.name}
              </Chip>
            );
          })}
        </div>

        {/* Loading Skeletons */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-1/2 rounded-md" />
                <Skeleton className="h-5 w-1/3 rounded-md" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={<Store className="w-8 h-8" />}
            title="No products match your criteria"
            description="Try relaxing your price filters or selecting a different category collection."
            actionLabel="Reset Filters"
            onAction={() => {
              onSelectCategory(null);
              setMaxPrice(5000000);
              setMinRating(0);
            }}
          />
        ) : (
          /* Product Grid with scroll reveal animations */
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product, idx) => {
              const mainImage = product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';
              const firstVariant = product.variants?.[0];
              const displayPrice = firstVariant ? firstVariant.pricePaise : product.basePricePaise;
              const compareAt = firstVariant?.compareAtPricePaise;
              const isAdded = addedItemMap[product.id];
              const isWished = wishlistIds.includes(product.id);
              const shopSlug = (product as any).shopSlug || product.sellerId;
              const isSoldOut = (product.inventoryTotal ?? 1) <= 0;
              const isLowStock = !isSoldOut && (product.inventoryTotal ?? 10) <= 3;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.25, delay: (idx % 4) * 0.04 }}
                  onClick={() => onOpenProduct(product)}
                  className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden hover:shadow-card-hover hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Square Image Container with zoom 1.06 on hover */}
                    <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={mainImage}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-300"
                        width={300}
                        height={300}
                        loading="lazy"
                      />

                      {/* Top Badges (Sale, Low stock, New) */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
                        {compareAt && compareAt > displayPrice && (
                          <Badge variant="danger" size="sm">
                            Sale -{Math.round(((compareAt - displayPrice) / compareAt) * 100)}%
                          </Badge>
                        )}
                        {isSoldOut && (
                          <Badge variant="danger" size="sm">
                            Sold out
                          </Badge>
                        )}
                        {isLowStock && (
                          <Badge variant="warning" size="sm">
                            Low Stock
                          </Badge>
                        )}
                      </div>

                      {/* Wishlist Heart Button (Top Right) with scale pop */}
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <IconButton
                          variant="default"
                          size="sm"
                          aria-label={isWished ? 'Remove from wishlist' : 'Add to wishlist'}
                          title={isWished ? 'Saved in wishlist' : 'Save to wishlist'}
                          onClick={(e) => handleHeartClick(product.id, e)}
                          className={`w-8 h-8 min-w-[32px] min-h-[32px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs shadow-xs transition-transform duration-150 ${
                            isWished ? 'text-rose-500 scale-110' : 'text-slate-600 hover:text-rose-500'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 transition-colors ${
                              isWished ? 'fill-rose-500 text-rose-500' : ''
                            }`}
                          />
                        </IconButton>
                      </div>

                      {/* Quick Add To Cart Button: Slides up on hover, always visible on touch */}
                      <div className="absolute bottom-2.5 inset-x-2.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 touch-always-visible z-10">
                        <Button
                          variant="primary"
                          fullWidth
                          size="sm"
                          shine
                          onClick={(e) => handleQuickAdd(product, e)}
                          disabled={isSoldOut}
                          leftIcon={isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          className={isAdded ? '!bg-emerald-600 !shadow-emerald-600/30' : ''}
                        >
                          {isSoldOut ? 'Sold out' : isAdded ? 'Added to Cart' : 'Quick Add'}
                        </Button>
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="p-3.5 sm:p-4 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (shopSlug) onOpenShop(shopSlug);
                          }}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 truncate max-w-[130px]"
                        >
                          <Store className="w-3 h-3 shrink-0" />
                          <span className="truncate">{product.shopName}</span>
                          <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                        </span>

                        <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{product.rating.toFixed(1)}</span>
                          <span className="text-slate-400 font-normal">({product.reviewCount})</span>
                        </div>
                      </div>

                      <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {product.name}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  {/* Price & SKU Footer */}
                  <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-1 flex items-baseline justify-between border-t border-slate-100 dark:border-slate-800">
                    <PriceTag
                      priceCents={displayPrice}
                      compareAtCents={compareAt}
                      size="sm"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">
                      {product.sku}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 18: Recently Viewed Row */}
      {recentlyViewed.length > 0 && (
        <section className="space-y-4 pt-8 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Recently Viewed
              </h3>
              <p className="text-xs text-slate-400">Products you checked during this session</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {recentlyViewed.slice(0, 6).map((rp) => (
              <div
                key={rp.id}
                onClick={() => onOpenProduct(rp)}
                className="group p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer space-y-2"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={rp.images?.[0] || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800'}
                    alt={rp.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                    {rp.name}
                  </p>
                  <p className="font-mono font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                    {formatMoney(rp.basePricePaise)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mobile Filter Bottom Sheet Drawer */}
      <Drawer
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter & Sort"
        position="bottom"
      >
        <div className="space-y-5 p-2 text-xs">
          <div className="space-y-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">Sort By</span>
            <div className="relative flex items-center">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 appearance-none pr-9 outline-none focus:ring-2 focus:ring-indigo-500/50"
                aria-label="Sort by"
              >
                <option value="newest" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Newest Arrivals</option>
                <option value="price_asc" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Price: Low to High</option>
                <option value="price_desc" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Price: High to Low</option>
                <option value="rating" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Top Rated</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 shrink-0" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">Max Price</span>
              <span className="font-mono font-bold text-indigo-600">{formatMoney(maxPrice)}</span>
            </div>
            <input
              type="range"
              min="50000"
              max="5000000"
              step="50000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          <div className="flex gap-2.5 pt-3">
            <Button
              variant="ghost"
              fullWidth
              size="md"
              onClick={() => {
                onSelectCategory(null);
                setMaxPrice(5000000);
                setMinRating(0);
                setIsFilterSheetOpen(false);
              }}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              fullWidth
              size="md"
              onClick={() => setIsFilterSheetOpen(false)}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
