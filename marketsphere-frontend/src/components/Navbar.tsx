import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Store, 
  ShieldCheck, 
  Package, 
  ChevronDown, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  Heart,
  LogOut,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { User, Category } from '../types/index.ts';
import { Button, IconButton, Badge, Drawer } from './ui/index.ts';
import { useTheme } from '../lib/theme.ts';
import { NotificationBell } from './NotificationBell.tsx';
import { Logo } from './Logo.tsx';

export interface NavbarProps {
  currentUser: User | null;
  currentView: 'storefront' | 'orders' | 'seller' | 'admin' | 'shop';
  cartCount: number;
  onSelectView: (view: 'storefront' | 'orders' | 'seller' | 'admin' | 'shop') => void;
  onOpenCart: () => void;
  onOpenSellerApply: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categories?: Category[];
  selectedCategory?: string | null;
  onSelectCategory?: (catId: string | null) => void;
  wishlistCount?: number;
  onOpenWishlist?: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  orders?: any[];
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentView,
  cartCount,
  onSelectView,
  onOpenCart,
  onOpenSellerApply,
  searchQuery,
  onSearchChange,
  categories = [],
  selectedCategory,
  onSelectCategory,
  wishlistCount = 0,
  onOpenWishlist,
  onOpenLogin,
  onLogout,
  orders = [],
}) => {
  const { theme, toggleTheme } = useTheme();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

  // Global "/" keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserDropdown(false);
        setShowCategoryMenu(false);
      }
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        !document.activeElement?.getAttribute('contenteditable')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter links strictly based on user authentication and role
  const navLinks: Array<{ id: 'storefront' | 'orders' | 'seller' | 'admin'; label: string; icon: React.ReactNode }> = [
    { id: 'storefront', label: 'Marketplace', icon: null },
  ];

  if (currentUser) {
    navLinks.push({ id: 'orders', label: 'My Orders', icon: <Package className="w-4 h-4 shrink-0" /> });
    if (currentUser.role === 'CUSTOMER' || currentUser.role === 'SELLER') {
      navLinks.push({ id: 'seller', label: 'Seller Hub', icon: <Store className="w-4 h-4 shrink-0" /> });
    }
    if (currentUser.role === 'ADMIN') {
      navLinks.push({ id: 'admin', label: 'Admin', icon: <ShieldCheck className="w-4 h-4 shrink-0" /> });
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      {/* Fixed 64px (h-16) Single Row Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Mobile Menu Trigger + Brand Logo + Desktop Nav Links */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <IconButton
            variant="default"
            size="sm"
            aria-label="Open navigation menu"
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden h-10 w-10 min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          </IconButton>

          <Logo
            size="md"
            showWordmark={true}
            onClick={() => {
              onSelectView('storefront');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          {/* Desktop Nav Links (lg and above) */}
          <nav className="hidden lg:flex items-center gap-1 ml-2 shrink-0" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive = currentView === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onSelectView(link.id)}
                  className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isActive
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center: Search Field (Desktop & Tablet md+) */}
        <div className="hidden md:flex flex-1 min-w-[200px] max-w-md mx-2">
          <div className="relative w-full h-10 flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products, brands..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-10 pl-9 pr-9 xl:pr-14 text-xs sm:text-sm bg-slate-100/90 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-transparent rounded-full focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
            <div className="absolute right-3 flex items-center gap-1">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden xl:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-2xs pointer-events-none">
                  /
                </kbd>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions, Theme, Cart, Account Group */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile search toggle button */}
          <IconButton
            variant="default"
            size="sm"
            aria-label="Search products"
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            className="md:hidden h-10 w-10 min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center shrink-0"
          >
            <Search className="w-4 h-4 text-slate-700 dark:text-slate-200" />
          </IconButton>

          {/* Optional Category dropdown if categories exist */}
          {categories.length > 0 && (
            <div className="relative hidden xl:block shrink-0" ref={categoryMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                rightIcon={<ChevronDown className="w-3.5 h-3.5" />}
                className="h-10 text-xs font-semibold whitespace-nowrap"
              >
                Categories
              </Button>
              <AnimatePresence>
                {showCategoryMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCategory?.(null);
                        setShowCategoryMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                        !selectedCategory
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          onSelectCategory?.(cat.id);
                          setShowCategoryMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                          selectedCategory === cat.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Become a Seller button for signed-in CUSTOMER */}
          {currentUser?.role === 'CUSTOMER' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenSellerApply}
              leftIcon={<Store className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
              className="hidden xl:inline-flex h-10 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Become a Seller
            </Button>
          )}

          {/* Theme Toggle Button */}
          <IconButton
            variant="default"
            size="sm"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
            className="h-10 w-10 min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 transition-transform duration-300 hover:-rotate-12" />
            )}
          </IconButton>

          {/* Wishlist Button */}
          <IconButton
            variant="default"
            size="sm"
            aria-label={`Saved Wishlist with ${wishlistCount} items`}
            onClick={onOpenWishlist}
            className="relative h-10 w-10 min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center shrink-0"
          >
            <Heart className={`w-4 h-4 ${wishlistCount > 0 ? 'text-rose-500 fill-rose-500/20' : 'text-slate-700 dark:text-slate-200'}`} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 pointer-events-none">
                {wishlistCount}
              </span>
            )}
          </IconButton>

          {/* Notifications Button */}
          <div className="shrink-0">
            <NotificationBell orders={orders} />
          </div>

          {/* Cart Button */}
          <IconButton
            variant="default"
            size="sm"
            aria-label={`Shopping Cart with ${cartCount} items`}
            onClick={onOpenCart}
            className="relative h-10 w-10 min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center shrink-0"
          >
            <ShoppingBag className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [1, 1.25, 1], opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="absolute -top-1 -right-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-sm pointer-events-none"
                >
                  {cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </IconButton>

          {/* Account Button / Sign In Button */}
          {currentUser ? (
            <div className="relative shrink-0" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="h-10 inline-flex items-center gap-2 p-1 sm:px-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 whitespace-nowrap shrink-0"
                aria-label="User account menu"
                aria-expanded={showUserDropdown}
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={currentUser.fullName}
                  className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                  width={28}
                  height={28}
                  loading="lazy"
                />
                <div className="hidden xl:flex flex-col justify-center leading-none">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
                    {currentUser.fullName.split(' ')[0]}
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                    {currentUser.role}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden xl:block shrink-0" />
              </button>

              <AnimatePresence>
                {showUserDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50"
                  >
                    <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {currentUser.fullName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {currentUser.email}
                      </p>
                      <div className="mt-1.5">
                        <Badge
                          variant={
                            currentUser.role === 'ADMIN'
                              ? 'purple'
                              : currentUser.role === 'SELLER'
                              ? 'success'
                              : 'primary'
                          }
                          size="sm"
                        >
                          {currentUser.role}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-0.5 py-1">
                      {currentUser.role === 'CUSTOMER' && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenSellerApply();
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Store className="w-4 h-4 shrink-0" />
                          <span>Become a Seller</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSelectView('orders');
                          setShowUserDropdown(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                      >
                        <Package className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>My Orders</span>
                      </button>

                      {(currentUser.role === 'SELLER' || currentUser.role === 'CUSTOMER') && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectView('seller');
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        >
                          <Store className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>Seller Hub</span>
                        </button>
                      )}

                      {currentUser.role === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectView('admin');
                            setShowUserDropdown(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4 text-violet-500 shrink-0" />
                          <span>Admin Console</span>
                        </button>
                      )}
                    </div>

                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenLogin}
              className="h-10 px-4 text-xs font-semibold whitespace-nowrap shrink-0 shadow-sm"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Mobile Search Row (below the 64px header, toggled cleanly on mobile) */}
      <AnimatePresence>
        {isMobileSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-slate-200/80 dark:border-slate-800 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/90 overflow-hidden"
          >
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={mobileSearchInputRef}
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full h-10 pl-9 pr-9 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Slide-in Drawer for navigation */}
      <Drawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        title="Navigation"
        position="left"
        maxWidth="max-w-xs"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const isActive = currentView === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => {
                    onSelectView(link.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {link.icon || <Package className="w-4 h-4" />}
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          {currentUser?.role === 'CUSTOMER' && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="primary"
                fullWidth
                size="md"
                onClick={() => {
                  onOpenSellerApply();
                  setIsMobileMenuOpen(false);
                }}
                leftIcon={<Store className="w-4 h-4" />}
              >
                Become a Seller
              </Button>
            </div>
          )}

          {!currentUser ? (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="primary"
                fullWidth
                size="md"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenLogin();
                }}
              >
                Sign In / Register
              </Button>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="danger"
                fullWidth
                size="md"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogout();
                }}
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </Drawer>
    </header>
  );
};
