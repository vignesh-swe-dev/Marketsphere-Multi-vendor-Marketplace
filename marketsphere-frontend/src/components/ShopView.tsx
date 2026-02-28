import React from 'react';
import { 
  ArrowLeft, 
  Star, 
  Store, 
  ShieldCheck, 
  Truck, 
  RotateCcw,
  Check,
  Calendar,
  Users,
  Award,
  ShoppingBag,
  Plus
} from 'lucide-react';
import type { Shop, Product } from '../types/index.ts';
import { formatMoney, formatDate } from '../lib/formatters.ts';
import { Button, IconButton, Badge, PriceTag, StarRating, EmptyState } from './ui/index.ts';

interface ShopViewProps {
  shop: Shop | null;
  products: Product[];
  onBack: () => void;
  onOpenProduct: (product: Product) => void;
  onAddToCart: (product: Product, variantId?: string) => void;
}

export const ShopView: React.FC<ShopViewProps> = ({
  shop,
  products,
  onBack,
  onOpenProduct,
  onAddToCart,
}) => {
  if (!shop) return null;

  return (
    <div className="space-y-8 pb-20">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        leftIcon={<ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />}
        className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600"
      >
        Back to Marketplace
      </Button>

      {/* Shop Banner & Profile Header */}
      <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        {/* Banner Image with subtle dark overlay */}
        <div className="h-48 sm:h-64 w-full bg-slate-900 relative overflow-hidden">
          <img
            src={shop.bannerUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200'}
            alt={shop.name}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
        </div>

        {/* Profile Info Overlay */}
        <div className="p-6 sm:p-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
            <div className="flex items-end gap-4">
              <img
                src={shop.logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'}
                alt={shop.name}
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white dark:border-slate-900 shadow-xl bg-white dark:bg-slate-800 shrink-0"
                width={96}
                height={96}
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {shop.name}
                  </h1>
                  <Badge variant="success" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                    Verified Partner
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{shop.tagline}</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/60">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{shop.rating.toFixed(1)}</span>
                <span className="text-slate-400 font-normal">({shop.reviewCount} reviews)</span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>1.4k Followers</span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Since {formatDate(shop.createdAt).split(',')[1] || '2023'}</span>
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed mt-3">
            {shop.description}
          </p>

          {/* Policy Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100 block">Direct Fulfillment Policy:</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {shop.shippingPolicy || 'Direct tracked dispatch within 24-48 business hours with tracking confirmation.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100 block">Return & Inspection Policy:</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {shop.refundPolicy || '30-day inspection period with automated ledger refunds upon return verification.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog of this Shop */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Curated Catalog by {shop.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Artisanal and precision goods directly made and dispatched by this studio
          </p>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={<Store className="w-8 h-8" />}
            title="No published products in this shop"
            description="This merchant has not listed any live items in this collection yet."
            actionLabel="Back to Marketplace"
            onAction={onBack}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {products.map((product) => {
              const mainImage = product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';
              const firstVariant = product.variants?.[0];
              const price = firstVariant ? firstVariant.pricePaise : product.basePricePaise;
              const compareAt = firstVariant?.compareAtPricePaise;

              return (
                <div
                  key={product.id}
                  onClick={() => onOpenProduct(product)}
                  className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden hover:shadow-card-hover hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                      <img
                        src={mainImage}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-300"
                        loading="lazy"
                        width={300}
                        height={300}
                      />
                    </div>
                    <div className="p-3.5 sm:p-4 space-y-1.5">
                      <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 text-[11px]">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{product.rating.toFixed(1)}</span>
                        <span className="text-slate-400 font-normal">({product.reviewCount})</span>
                      </div>

                      <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 pt-1 flex items-baseline justify-between border-t border-slate-100 dark:border-slate-800">
                    <PriceTag
                      priceCents={price}
                      compareAtCents={compareAt}
                      size="sm"
                    />

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(product, firstVariant?.id);
                      }}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
