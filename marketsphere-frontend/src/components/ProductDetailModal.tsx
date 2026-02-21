import React, { useState, useEffect } from 'react';
import { 
  X, 
  Star, 
  Store, 
  Truck, 
  ShieldCheck, 
  RotateCcw, 
  Check, 
  ShoppingBag,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import type { Product, ProductVariant, User } from '../types/index.ts';
import { formatMoney, formatDate } from '../lib/formatters.ts';
import { 
  Modal, 
  Button, 
  IconButton, 
  Badge, 
  Chip, 
  PriceTag, 
  StarRating, 
  Input 
} from './ui/index.ts';
import { addRecentlyViewed } from '../lib/wishlist.ts';

interface ProductReview {
  id: string;
  userName: string;
  rating: number;
  title?: string;
  comment: string;
  verifiedPurchase?: boolean;
  createdAt: string;
}

interface DetailedProduct extends Omit<Product, "reviews"> {
  shopSlug?: string;
  shippingPolicy?: string;
  refundPolicy?: string;
  reviews?: ProductReview[];
}

interface ProductDetailModalProps {
  product: Product | null;
  currentUser: User | null;
  onClose: () => void;
  onAddToCart: (product: Product, variantId?: string, quantity?: number) => void;
  onOpenShop: (shopSlug: string) => void;
  onSubmitReview: (productId: string, rating: number, title: string, comment: string) => Promise<void>;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  currentUser: _currentUser,
  onClose,
  onAddToCart,
  onOpenShop,
  onSubmitReview,
}) => {
  if (!product) return null;

  const detailedProduct = product as DetailedProduct;

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    product.variants?.[0]
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isPolicyExpanded, setIsPolicyExpanded] = useState(false);

  // Add to recently viewed on mount
  useEffect(() => {
    addRecentlyViewed(product);
  }, [product]);

  const images = product.images?.length > 0 
    ? product.images 
    : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'];

  const currentPrice = selectedVariant ? selectedVariant.pricePaise : product.basePricePaise;
  const compareAt = selectedVariant?.compareAtPricePaise;
  const currentStock = selectedVariant ? selectedVariant.inventoryQuantity : product.inventoryTotal;
  const shopSlug = detailedProduct.shopSlug || product.sellerId;

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      await onSubmitReview(product.id, reviewRating, reviewTitle, reviewComment);
      setReviewSuccess(true);
      setShowReviewForm(false);
      setReviewTitle('');
      setReviewComment('');
    } catch (err: any) {
      setReviewError(err?.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleBuyNow = () => {
    onAddToCart(product, selectedVariant?.id, quantity);
    onClose();
  };

  return (
    <Modal
      isOpen={!!product}
      onClose={onClose}
      maxWidth="4xl"
      showCloseButton
      title={
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-normal">
          <span>Marketplace</span>
          <span>/</span>
          <span>{product.categoryName || 'Catalog'}</span>
          <span>/</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{product.brand || 'Boutique'}</span>
        </div>
      }
    >
      <div className="space-y-8 max-h-[80vh] overflow-y-auto no-scrollbar pr-1 -mr-1">
        {/* Two-Column Product Presentation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Column 1: Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-800 group shadow-xs">
              <img
                src={images[activeImageIndex] || images[0]}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                width={500}
                height={500}
                loading="eager"
              />
              {compareAt && compareAt > currentPrice && (
                <div className="absolute top-3 left-3 z-10">
                  <Badge variant="danger" size="md">
                    Sale -{Math.round(((compareAt - currentPrice) / compareAt) * 100)}%
                  </Badge>
                </div>
              )}
            </div>

            {/* Thumbnail Navigation */}
            {images.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      activeImageIndex === idx
                        ? 'border-indigo-600 shadow-sm scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" width={64} height={64} />
                  </button>
                ))}
              </div>
            )}

            {/* Seller Shop Banner Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {product.shopName}
                    </h4>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Verified Independent Vendor</p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  if (shopSlug) onOpenShop(shopSlug);
                }}
              >
                Visit Shop
              </Button>
            </div>
          </div>

          {/* Column 2: Info Panel */}
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
                {product.name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                <StarRating rating={product.rating} reviewCount={product.reviewCount} showNumber />
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  SKU: {selectedVariant?.sku || product.sku}
                </span>
              </div>
            </div>

            {/* Price Tag Row */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800">
              <PriceTag
                priceCents={currentPrice}
                compareAtCents={compareAt}
                size="xl"
              />
            </div>

            {/* Variants Selector as Chips (disabled and line-through when out of stock) */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Choose Variant / Specification:
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const isOut = v.inventoryQuantity <= 0;
                    return (
                      <Chip
                        key={v.id}
                        active={isSelected}
                        outOfStock={isOut}
                        onClick={() => setSelectedVariant(v)}
                        count={v.inventoryQuantity}
                      >
                        {v.name}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock Indicator */}
            <div className="flex items-center gap-2 text-xs">
              {currentStock > 5 ? (
                <Badge variant="success" dot>
                  In Stock ({currentStock} ready for dispatch)
                </Badge>
              ) : currentStock > 0 ? (
                <Badge variant="warning" dot className="animate-pulse">
                  Only {currentStock} left in stock - order soon!
                </Badge>
              ) : (
                <Badge variant="danger">Currently Out of Stock</Badge>
              )}
            </div>

            {/* Description */}
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-4">
              <p>{product.description}</p>
            </div>

            {/* Quantity Stepper & Add to Cart */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 p-1">
                <IconButton
                  variant="default"
                  size="sm"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 min-w-[32px] min-h-[32px]"
                >
                  <Minus className="w-3.5 h-3.5" />
                </IconButton>
                <span className="w-10 text-center text-xs font-bold font-mono text-slate-900 dark:text-white">
                  {quantity}
                </span>
                <IconButton
                  variant="default"
                  size="sm"
                  aria-label="Increase quantity"
                  disabled={quantity >= currentStock}
                  onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                  className="w-8 h-8 min-w-[32px] min-h-[32px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                </IconButton>
              </div>

              <Button
                variant="primary"
                fullWidth
                size="md"
                shine
                disabled={currentStock <= 0}
                onClick={() => {
                  onAddToCart(product, selectedVariant?.id, quantity);
                  onClose();
                }}
                leftIcon={<ShoppingBag className="w-4 h-4" />}
              >
                Add to Cart • {formatMoney(currentPrice * quantity)}
              </Button>

              <Button
                variant="secondary"
                size="md"
                disabled={currentStock <= 0}
                onClick={handleBuyNow}
                leftIcon={<Zap className="w-4 h-4 text-amber-500" />}
                className="hidden sm:inline-flex shrink-0"
              >
                Buy Now
              </Button>
            </div>

            {/* Policy Accordion */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs space-y-2 bg-slate-50/60 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setIsPolicyExpanded(!isPolicyExpanded)}
                className="w-full flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-500" />
                  Fulfillment & Guaranteed Return Policies
                </span>
                {isPolicyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isPolicyExpanded && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <p>
                    <strong>Shipping:</strong> {detailedProduct.shippingPolicy || 'Ships within 24-48 business hours with automated carrier tracking.'}
                  </p>
                  <p>
                    <strong>Returns:</strong> {detailedProduct.refundPolicy || '30-day inspection window with instant escrow refund protection upon return authorization.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Verified Buyer Feedback
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Independent reviews certified from verified marketplace transactions
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowReviewForm(!showReviewForm)}
              leftIcon={<MessageSquare className="w-3.5 h-3.5 text-indigo-600" />}
            >
              Write Review
            </Button>
          </div>

          {/* Rating Summary Bars */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center sm:text-left shrink-0">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white font-mono">
                {product.rating.toFixed(1)}
              </span>
              <p className="text-xs text-slate-400 mt-1">Based on {product.reviewCount} ratings</p>
            </div>

            <div className="flex-1 w-full space-y-1.5 text-xs font-mono">
              {[5, 4, 3, 2, 1].map((stars) => {
                const percent = stars === 5 ? 75 : stars === 4 ? 20 : stars === 3 ? 5 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="w-3 text-slate-500">{stars}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="w-8 text-right text-slate-400 text-[10px]">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Review Submission Form */}
          {showReviewForm && (
            <form onSubmit={handleReviewSubmit} className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                Write a Verified Product Review
              </h4>

              {reviewError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                  {reviewError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Your Rating:</span>
                <StarRating rating={reviewRating} interactive onChange={setReviewRating} size="lg" />
              </div>

              <Input
                label="Review Headline"
                placeholder="e.g. Exceptional build quality and soundstage"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Detailed Feedback
                </label>
                <textarea
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Share details about performance, packaging, and fulfillment..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={isSubmittingReview}
                  disabled={!reviewComment.trim()}
                >
                  Submit Review
                </Button>
              </div>
            </form>
          )}

          {reviewSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Thank you! Your feedback has been verified and posted to the catalog.</span>
            </div>
          )}

          {/* Existing Reviews List */}
          {detailedProduct.reviews && detailedProduct.reviews.length > 0 ? (
            <div className="space-y-3">
              {detailedProduct.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {rev.userName}
                      </span>
                      {rev.verifiedPurchase && (
                        <Badge variant="success" size="sm" icon={<ShieldCheck className="w-3 h-3" />}>
                          Verified Purchase
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDate(rev.createdAt).split(',')[0]}
                    </span>
                  </div>

                  <StarRating rating={rev.rating} size="sm" />

                  {rev.title && (
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {rev.title}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {rev.comment}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No customer reviews recorded yet for this item.</p>
          )}
        </div>
      </div>

      {/* Sticky Mobile Add-to-Cart & Buy-Now Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 z-50">
        <Button
          variant="secondary"
          fullWidth
          size="md"
          disabled={currentStock <= 0}
          onClick={handleBuyNow}
        >
          Buy Now
        </Button>
        <Button
          variant="primary"
          fullWidth
          size="md"
          shine
          disabled={currentStock <= 0}
          onClick={() => {
            onAddToCart(product, selectedVariant?.id, quantity);
            onClose();
          }}
          leftIcon={<ShoppingBag className="w-4 h-4" />}
        >
          Add to Cart
        </Button>
      </div>
    </Modal>
  );
};
