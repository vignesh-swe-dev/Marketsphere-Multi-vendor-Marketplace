import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Store, ArrowLeft } from 'lucide-react';
import { Navbar } from './components/Navbar.tsx';
import { Storefront } from './components/Storefront.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { ShopView } from './components/ShopView.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { CheckoutModal } from './components/CheckoutModal.tsx';
import { CustomerOrders } from './components/CustomerOrders.tsx';
import { SellerDashboard } from './components/SellerDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { SellerApplicationModal } from './components/SellerApplicationModal.tsx';
import { WishlistDrawer } from './components/WishlistDrawer.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { Footer } from './components/Footer.tsx';
import { OfflineBanner } from './components/OfflineBanner.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { Button } from './components/ui/Button.tsx';
import { ToastContainer, type ToastItem } from './components/ui/Toast.tsx';
import { useWishlist } from './lib/wishlist.ts';
import type { User, Product, Category, CartItem, Order, Shop } from './types/index.ts';
import { apiFetch, restoreSession, logout, fetchMe, onSessionExpired } from './lib/apiClient.ts';
import { formatMoney } from './lib/formatters.ts';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'storefront' | 'orders' | 'seller' | 'admin' | 'shop'>('storefront');
  
  // Catalog Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  
  // Active Shop View
  const [activeShopSlug, setActiveShopSlug] = useState<string | null>(null);
  const [activeShopData, setActiveShopData] = useState<{ shop: Shop; products: Product[] } | null>(null);

  // Modals & Drawers
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSellerApplyOpen, setIsSellerApplyOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Global Toasts State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    action?: { label: string; onClick: () => void }
  ) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, type, action }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [appliedDiscountCents, setAppliedDiscountCents] = useState<number>(0);

  // Wishlist State Hook
  const { wishlistIds, toggleWishlist } = useWishlist();

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);

  // Initial Data & Session Restore
  const fetchCatalogData = async () => {
    setIsLoadingCatalog(true);
    try {
      const [prodsData, catsData] = await Promise.all([
        apiFetch<{ products: Product[] }>('/products?status=PUBLISHED'),
        apiFetch<{ categories: Category[] }>('/categories'),
      ]);

      setProducts(prodsData.products || []);
      setCategories(catsData.categories || []);
    } catch (err) {
      console.error('Error loading catalog data:', err);
      addToast('Failed to load marketplace catalog', 'error');
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const data = await apiFetch<{ orders: Order[] }>('/orders');
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrders([]);
    }
  };

  // On App Mount: restore session from httpOnly cookie and load catalog
  useEffect(() => {
    const initApp = async () => {
      // Listen for expired sessions
      const unsub = onSessionExpired(() => {
        setCurrentUser(null);
        setOrders([]);
        addToast('Your session has expired. Please sign in again.', 'warning');
      });

      try {
        const restoredUser = await restoreSession();
        if (restoredUser) {
          setCurrentUser(restoredUser);
        }
      } catch (err) {
        console.error('Session restore failed:', err);
      }

      await fetchCatalogData();
      return unsub;
    };

    initApp();
  }, []);

  // Whenever currentUser changes, load orders if logged in
  useEffect(() => {
    if (currentUser) {
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [currentUser]);

  // Handle protected navigation checks (guest gating)
  const handleSelectView = async (view: 'storefront' | 'orders' | 'seller' | 'admin' | 'shop') => {
    if (view === 'orders' || view === 'seller') {
      if (!currentUser) {
        setIsLoginOpen(true);
        return;
      }
    }

    if (view === 'seller') {
      // Re-fetch latest user profile to reflect any newly approved seller status
      const freshUser = await fetchMe();
      if (freshUser) {
        setCurrentUser(freshUser);
      }
    }

    if (view !== 'shop') {
      setActiveShopSlug(null);
    }

    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sign out handler
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setOrders([]);
    setCurrentView('storefront');
    addToast('Signed out successfully', 'info');
  };

  // Load Shop details when activeShopSlug changes
  useEffect(() => {
    if (activeShopSlug) {
      apiFetch<{ shop: Shop; products: Product[] }>(`/shops/${activeShopSlug}`)
        .then((data) => {
          if (data.shop) {
            setActiveShopData({
              shop: data.shop,
              products: data.products || [],
            });
          }
        })
        .catch(console.error);
    } else {
      setActiveShopData(null);
    }
  }, [activeShopSlug]);

  // Cart operations
  const handleAddToCart = (product: Product, variantId?: string, quantity = 1) => {
    const selectedVariant = product.variants?.find((v) => v.id === variantId) || product.variants?.[0];
    
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.productId === product.id && it.selectedVariant?.id === selectedVariant?.id
      );

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += quantity;
        return copy;
      } else {
        return [
          ...prev,
          {
            id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            productId: product.id,
            variantId: selectedVariant?.id,
            quantity,
            product,
            selectedVariant,
          },
        ];
      }
    });

    addToast(`Added "${product.name}" to cart`, 'success');
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(cartItemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((it) => (it.id === cartItemId ? { ...it, quantity: newQty } : it))
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    const itemToRemove = cartItems.find((it) => it.id === cartItemId);
    setCartItems((prev) => prev.filter((it) => it.id !== cartItemId));
    if (itemToRemove) {
      addToast(`Removed "${itemToRemove.product.name}"`, 'info', {
        label: 'Undo',
        onClick: () => {
          setCartItems((prev) => [...prev, itemToRemove]);
        },
      });
    }
  };

  const handleApplyCoupon = async (code: string): Promise<boolean> => {
    const totalGross = cartItems.reduce((sum, it) => {
      const price = it.selectedVariant ? it.selectedVariant.pricePaise : it.product.basePricePaise;
      return sum + price * it.quantity;
    }, 0);

    if (code === 'WELCOME10') {
      const disc = Math.round(totalGross * 0.1);
      setAppliedCoupon('WELCOME10');
      setAppliedDiscountCents(disc);
      addToast('Coupon WELCOME10 applied (10% off)', 'success');
      return true;
    } else if (code === 'SAVE25') {
      if (totalGross < 15000) {
        addToast(`SAVE25 requires a minimum order of ${formatMoney(15000)}`, 'error');
        return false;
      }
      setAppliedCoupon('SAVE25');
      setAppliedDiscountCents(2500);
      addToast(`Coupon SAVE25 applied (${formatMoney(2500)} off)`, 'success');
      return true;
    }
    return false;
  };

  const handleOpenShop = (shopSlug: string) => {
    setActiveShopSlug(shopSlug);
    setCurrentView('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit product review (verified purchase only, once)
  const handleSubmitReview = async (productId: string, rating: number, title: string, comment: string) => {
    if (!currentUser) {
      setIsLoginOpen(true);
      throw new Error('Please sign in to submit a product review');
    }

    // Call real API - token provides identity, no client userId sent
    await apiFetch('/reviews', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        rating,
        title,
        comment,
      }),
    });

    addToast('Review submitted successfully!', 'success');
    
    // Refresh catalog
    const prodsData = await apiFetch<{ products: Product[] }>('/products?status=PUBLISHED');
    setProducts(prodsData.products || []);
    
    // Refresh activeProduct modal if open
    if (activeProduct && activeProduct.id === productId) {
      const singleData = await apiFetch<{ product: Product }>(`/products/${productId}`);
      setActiveProduct(singleData.product);
    }
  };

  // Customer requests a refund
  const handleCustomerRequestRefund = async (orderId: string, _sellerOrderId?: string, _amountCents?: number, reason?: string) => {
    await apiFetch(`/orders/${orderId}/refund-request`, {
      method: 'POST',
      body: JSON.stringify({
        reason: reason || 'Customer requested refund',
      }),
    });
    addToast('Refund request submitted for administrator review', 'success');
    fetchOrders();
  };

  const handleOrderSuccess = (newOrder: Order) => {
    setCartItems([]);
    setAppliedCoupon('');
    setAppliedDiscountCents(0);
    fetchOrders();
    addToast(`Order #${newOrder.orderNumber} successfully confirmed!`, 'success');
  };

  const wishlistProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
        <OfflineBanner />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        <Navbar
          currentUser={currentUser}
          currentView={currentView}
          cartCount={cartItems.reduce((sum, it) => sum + it.quantity, 0)}
          onSelectView={handleSelectView}
          onOpenCart={() => setIsCartOpen(true)}
          onOpenSellerApply={() => {
            if (!currentUser) {
              setIsLoginOpen(true);
            } else {
              setIsSellerApplyOpen(true);
            }
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          wishlistCount={wishlistIds.length}
          onOpenWishlist={() => setIsWishlistOpen(true)}
          onOpenLogin={() => setIsLoginOpen(true)}
          onLogout={handleLogout}
          orders={orders}
        />

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'storefront' && (
                <Storefront
                  products={products.filter((p) => {
                    if (!searchQuery) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      p.description.toLowerCase().includes(q) ||
                      p.brand?.toLowerCase().includes(q)
                    );
                  })}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  onOpenProduct={(p) => setActiveProduct(p)}
                  onOpenShop={handleOpenShop}
                  onAddToCart={handleAddToCart}
                  onOpenSellerApply={() => {
                    if (!currentUser) setIsLoginOpen(true);
                    else setIsSellerApplyOpen(true);
                  }}
                  wishlistIds={wishlistIds}
                  onToggleWishlist={toggleWishlist}
                  isLoading={isLoadingCatalog}
                />
              )}

              {currentView === 'shop' && activeShopData && (
                <ShopView
                  shop={activeShopData.shop}
                  products={activeShopData.products}
                  onBack={() => {
                    setActiveShopSlug(null);
                    setCurrentView('storefront');
                  }}
                  onOpenProduct={(p) => setActiveProduct(p)}
                  onAddToCart={handleAddToCart}
                />
              )}

              {currentView === 'orders' && (
                <CustomerOrders
                  orders={orders}
                  currentUser={currentUser}
                  onRefreshOrders={fetchOrders}
                  onRequestRefund={handleCustomerRequestRefund}
                  onOpenReviewModal={(prodId) => {
                    const p = products.find((pr) => pr.id === prodId);
                    if (p) setActiveProduct(p);
                  }}
                />
              )}

              {currentView === 'seller' && (
                <SellerDashboard
                  currentUser={currentUser}
                  categories={categories}
                  onOpenApplyModal={() => setIsSellerApplyOpen(true)}
                  onRefreshData={() => {
                    fetchCatalogData();
                    fetchOrders();
                  }}
                />
              )}

              {currentView === 'admin' && (
                currentUser?.role === 'ADMIN' ? (
                  <AdminDashboard
                    categories={categories}
                    onRefreshData={() => {
                      fetchCatalogData();
                      fetchOrders();
                    }}
                  />
                ) : (
                  <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                      <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Admin access required</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        You do not have administrative privileges to view this console. Please sign in with an administrator account.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      fullWidth
                      size="md"
                      onClick={() => setCurrentView('storefront')}
                      leftIcon={<ArrowLeft className="w-4 h-4" />}
                    >
                      Return to Marketplace
                    </Button>
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Global Footer */}
        <Footer
          onOpenSellerApply={() => {
            if (!currentUser) setIsLoginOpen(true);
            else setIsSellerApplyOpen(true);
          }}
          onSelectCategory={(catId) => {
            setSelectedCategory(catId);
            setCurrentView('storefront');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* Cart Slide-Over Drawer */}
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          couponCode={appliedCoupon}
          appliedDiscountCents={appliedDiscountCents}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onApplyCoupon={handleApplyCoupon}
          onProceedToCheckout={() => {
            if (!currentUser) {
              setIsCartOpen(false);
              setIsLoginOpen(true);
            } else {
              setIsCheckoutOpen(true);
            }
          }}
        />

        {/* Wishlist Slide-Over Drawer */}
        <WishlistDrawer
          isOpen={isWishlistOpen}
          onClose={() => setIsWishlistOpen(false)}
          wishlistProducts={wishlistProducts}
          onRemoveFromWishlist={toggleWishlist}
          onAddToCart={handleAddToCart}
        />

        {/* Checkout Modal */}
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          currentUser={currentUser}
          items={cartItems}
          couponCode={appliedCoupon}
          onOrderSuccess={handleOrderSuccess}
        />

        {/* Product Detail Modal */}
        <ProductDetailModal
          product={activeProduct}
          currentUser={currentUser}
          onClose={() => setActiveProduct(null)}
          onAddToCart={handleAddToCart}
          onOpenShop={handleOpenShop}
          onSubmitReview={handleSubmitReview}
        />

        {/* Seller Application Modal */}
        <SellerApplicationModal
          isOpen={isSellerApplyOpen}
          onClose={() => setIsSellerApplyOpen(false)}
          currentUser={currentUser}
          onSuccess={() => {
            fetchCatalogData();
            addToast('Seller application submitted for review!', 'success');
          }}
        />

        {/* Sign In / Register Modal */}
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            if (user.role === 'ADMIN') setCurrentView('admin');
            else if (user.role === 'SELLER') setCurrentView('seller');
            else setCurrentView('storefront');
            addToast(`Signed in as ${user.fullName}`, 'success');
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
