import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Package, 
  IndianRupee, 
  TrendingUp, 
  Truck, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Tag, 
  AlertCircle,
  ExternalLink,
  CreditCard,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ShieldAlert,
  X,
  ChevronDown
} from 'lucide-react';
import type { User, Category, Product } from '../types/index.ts';
import { formatMoney, formatDate } from '../lib/formatters.ts';
import { 
  Button, 
  IconButton, 
  Badge, 
  Input, 
  Select, 
  Modal, 
  Drawer, 
  Tabs, 
  KPICard,
  EmptyState,
  Tooltip 
} from './ui/index.ts';
import { SalesChart } from './seller/SalesChart.tsx';
import { apiFetch } from '../lib/apiClient.ts';

interface SellerDashboardProps {
  currentUser: User | null;
  categories: Category[];
  onOpenApplyModal: () => void;
  onRefreshData: () => void;
}

export const SellerDashboard: React.FC<SellerDashboardProps> = ({
  currentUser,
  categories,
  onOpenApplyModal,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'financials'>('orders');
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [sellerProducts, setSellerProducts] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Orders filters & search
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // Product view toggle
  const [productViewMode, setProductViewMode] = useState<'grid' | 'list'>('grid');
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Fulfillment Modal State
  const [fulfillingOrder, setFulfillingOrder] = useState<any | null>(null);
  const [carrier, setCarrier] = useState('FedEx Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isFulfilling, setIsFulfilling] = useState(false);

  // Create Product Drawer State
  const [showProductModal, setShowProductModal] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState(categories[0]?.id || 'cat-electronics');
  const [prodPrice, setProdPrice] = useState(0);
  const [prodSku, setProdSku] = useState('');
  const [prodBrand, setProdBrand] = useState('');
  const [prodVariantName, setProdVariantName] = useState('Standard');
  const [prodStock, setProdStock] = useState(0);
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);

  const isSeller = currentUser?.role === 'SELLER';

  const loadData = async () => {
    if (!isSeller) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [dash, orders, prods] = await Promise.all([
        apiFetch('/seller/dashboard').catch(() => null),
        apiFetch('/seller/orders').catch(() => ({ sellerOrders: [] })),
        apiFetch('/products?status=ALL').catch(() => ({ products: [] })),
      ]);

      setDashboardData(dash);
      setSellerOrders(orders?.sellerOrders || []);
      setSellerProducts(prods?.products || []);
    } catch (err) {
      console.error('Failed to load seller dashboard data:', err);
      setDashboardData(null);
      setSellerOrders([]);
      setSellerProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillingOrder || !trackingNumber.trim()) return;
    setIsFulfilling(true);
    try {
      await apiFetch(`/seller/orders/${fulfillingOrder.id}/fulfillment`, {
        method: 'PATCH',
        body: JSON.stringify({
          shippingCarrier: carrier,
          trackingNumber: trackingNumber.trim(),
          status: 'SHIPPED',
        }),
      });
      setFulfillingOrder(null);
      setTrackingNumber('');
      loadData();
      onRefreshData();
    } catch (err) {
      console.error('Failed to update fulfillment:', err);
    } finally {
      setIsFulfilling(false);
    }
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSeller) return;
    setIsCreatingProduct(true);
    try {
      await apiFetch('/seller/products', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: prodCategoryId,
          name: prodName,
          description: prodDescription,
          basePriceCents: prodPrice,
          sku: prodSku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          brand: prodBrand,
          images: [prodImageUrl || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800'],
          variants: [
            {
              name: prodVariantName,
              sku: `${prodSku || 'SKU'}-01`,
              priceCents: prodPrice,
              inventoryQuantity: prodStock,
              attributes: { Edition: prodVariantName },
            },
          ],
        }),
      });

      setShowProductModal(false);
      setProdName('');
      setProdDescription('');
      setProdSku('');
      loadData();
    } catch (err) {
      console.error('Failed to create seller product:', err);
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const handleSimulatePayout = () => {
    setPayoutSuccessMsg('Payout request of available funds initiated to bank account. Status: Transferred.');
    setTimeout(() => setPayoutSuccessMsg(null), 5000);
  };

  if (currentUser?.role !== 'SELLER') {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
          <Store className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Seller Hub Access</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          You are currently logged in as a <strong>{currentUser?.role || 'Customer'}</strong>. Submit a vendor onboarding application to launch your shop and access the Seller Hub.
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={onOpenApplyModal}
        >
          Submit Vendor Application
        </Button>
      </div>
    );
  }

  const analytics = dashboardData?.analytics;
  const balance = dashboardData?.balance;

  // Filtered seller orders
  // Sales for the last 7 days, from this seller's real orders (cancelled and unpaid orders are left out)
  const weeklySales = (() => {
    const days: { date: string; salesCents: number; ordersCount: number; key: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        key: d.toDateString(),
        date: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        salesCents: 0,
        ordersCount: 0,
      });
    }
    for (const so of sellerOrders) {
      if (['CANCELLED', 'PENDING_PAYMENT', 'FAILED'].includes(so.status)) continue;
      const slot = days.find((d) => d.key === new Date(so.createdAt).toDateString());
      if (slot) {
        slot.salesCents += so.totalPaise || 0;
        slot.ordersCount += 1;
      }
    }
    return days.map(({ date, salesCents, ordersCount }) => ({ date, salesCents, ordersCount }));
  })();

  const filteredOrders = sellerOrders.filter((so) => {
    if (orderStatusFilter !== 'ALL' && so.status !== orderStatusFilter) return false;
    if (orderSearchQuery) {
      const q = orderSearchQuery.toLowerCase();
      return (
        so.order_number?.toLowerCase().includes(q) ||
        so.customer_name?.toLowerCase().includes(q) ||
        so.trackingNumber?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filtered seller products
  const filteredProducts = sellerProducts.filter((p) => {
    if (productSearchQuery) {
      const q = productSearchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
    }
    return true;
  });

  const sidebarNavItems = [
    { id: 'orders' as const, label: 'Fulfillment & Orders', icon: Package, count: sellerOrders.length },
    { id: 'products' as const, label: 'Catalog & Products', icon: Tag, count: sellerProducts.length },
    { id: 'financials' as const, label: 'Ledger & Payouts', icon: IndianRupee },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Seller Operations Center
            </h1>
            <Badge variant="success" size="sm" dot>
              Verified Merchant
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Store management, per-vendor dispatch tracking, automated ledger accounting
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            loading={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh Data
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowProductModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Product
          </Button>
        </div>
      </div>

      {/* KPI Cards (Gross sales, Net earnings, Available balance, Commission paid, Orders) with count-up animation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Gross Sales"
          value={analytics?.totalGrossPaise || 0}
          isCurrency
          icon={<IndianRupee className="w-5 h-5" />}
          subtitle="All completed suborders"
        />
        <KPICard
          title="Net Earnings"
          value={analytics?.totalNetEarningsPaise || 0}
          isCurrency
          icon={<TrendingUp className="w-5 h-5" />}
          subtitle="After platform commission"
        />
        <KPICard
          title="Available Balance"
          value={balance?.availablePaise || 0}
          isCurrency
          icon={<Wallet className="w-5 h-5" />}
          subtitle="Ready for instant payout"
        />
        <KPICard
          title="Commission Paid"
          value={analytics?.totalCommissionsPaidPaise || 0}
          isCurrency
          icon={<Tag className="w-5 h-5" />}
          subtitle="Automated market fees"
        />
        <KPICard
          title="Total Orders"
          value={analytics?.totalOrdersCount ?? sellerOrders.length}
          icon={<Package className="w-5 h-5" />}
          subtitle="Fulfillment suborders"
        />
      </div>

      {/* Sales Velocity Chart */}
      <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <SalesChart data={weeklySales} />
      </div>

      {/* Layout: Sidebar + Main Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Sidebar Navigation (Desktop) */}
        <aside className="hidden lg:block lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-3 shadow-xs space-y-1">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Merchant Navigation
            </span>
          </div>

          {sidebarNavItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Mobile Navigation Tabs (Bottom / horizontal bar) */}
        <div className="lg:hidden col-span-1 w-full overflow-x-auto no-scrollbar">
          <Tabs
            tabs={sidebarNavItems.map((item) => ({
              id: item.id,
              label: item.label.split(' ')[0],
              count: item.count,
            }))}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as any)}
            variant="pill"
          />
        </div>

        {/* Tab Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* TAB 1: ORDERS & FULFILLMENT */}
          {activeTab === 'orders' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Vendor Orders & Fulfillment Queue
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dispatch parcels, issue tracking numbers, and fulfill customer shipments
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search orders, buyer, tracking..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="relative flex items-center">
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                      className="py-1.5 pl-3 pr-8 text-xs bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 font-medium appearance-none outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/50"
                      aria-label="Filter orders by status"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="PAID">Paid (Needs Dispatch)</option>
                      <option value="SHIPPED">Shipped</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 shrink-0" />
                  </div>
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <EmptyState
                  icon={<Package className="w-8 h-8" />}
                  title="No orders found"
                  description="When customers place orders from your shop, they will appear here ready to fulfill."
                />
              ) : (
                <div className="overflow-x-auto">
                  {/* Desktop Table View */}
                  <table className="w-full text-left border-collapse text-xs hidden sm:table">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-3">Order #</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Net Payable</th>
                        <th className="py-3 px-3">Carrier / Tracking</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredOrders.map((so) => (
                        <tr
                          key={so.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            {so.order_number || so.id}
                            <span className="block text-[10px] text-slate-400 font-sans">
                              {formatDate(so.order_created_at || so.createdAt)}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {so.customer_name || 'Customer'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {so.customer_email}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <Badge
                              variant={
                                so.status === 'DELIVERED'
                                  ? 'success'
                                  : so.status === 'SHIPPED'
                                  ? 'primary'
                                  : so.status === 'PAID'
                                  ? 'warning'
                                  : 'neutral'
                              }
                              size="sm"
                              dot
                            >
                              {so.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-extrabold text-slate-900 dark:text-slate-100">
                            {formatMoney(so.sellerNetPayablePaise || 0)}
                          </td>
                          <td className="py-3.5 px-3">
                            {so.trackingNumber ? (
                              <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                                {so.shippingCarrier}: {so.trackingNumber}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Not Dispatched</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {so.status === 'PAID' ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setFulfillingOrder(so)}
                                leftIcon={<Truck className="w-3.5 h-3.5" />}
                              >
                                Ship Order
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFulfillingOrder(so)}
                              >
                                Update
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile Stacked Cards View */}
                  <div className="sm:hidden space-y-3">
                    {filteredOrders.map((so) => (
                      <div
                        key={so.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {so.order_number || so.id}
                          </span>
                          <Badge
                            variant={
                              so.status === 'DELIVERED'
                                ? 'success'
                                : so.status === 'SHIPPED'
                                ? 'primary'
                                : so.status === 'PAID'
                                ? 'warning'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {so.status}
                          </Badge>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <p className="font-medium">{so.customer_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Net: {formatMoney(so.sellerNetPayablePaise || 0)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {so.trackingNumber || 'Awaiting dispatch'}
                          </span>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setFulfillingOrder(so)}
                            leftIcon={<Truck className="w-3.5 h-3.5" />}
                          >
                            {so.status === 'PAID' ? 'Ship' : 'Edit'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRODUCTS */}
          {activeTab === 'products' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Vendor Product Inventory
                  </h3>
                  <p className="text-xs text-slate-400">
                    Manage active merchandise, stock inventory, and review statuses
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search SKU, name..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none"
                    />
                  </div>

                  {/* Grid / List Toggle */}
                  <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <IconButton
                      variant={productViewMode === 'grid' ? 'filled' : 'default'}
                      size="sm"
                      aria-label="Grid view"
                      title="Grid view"
                      onClick={() => setProductViewMode('grid')}
                      className="w-7 h-7 min-w-[28px] min-h-[28px]"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      variant={productViewMode === 'list' ? 'filled' : 'default'}
                      size="sm"
                      aria-label="List view"
                      title="List view"
                      onClick={() => setProductViewMode('list')}
                      className="w-7 h-7 min-w-[28px] min-h-[28px]"
                    >
                      <List className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowProductModal(true)}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add Product
                  </Button>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <EmptyState
                  icon={<Tag className="w-8 h-8" />}
                  title="No products listed"
                  description="Add items to your catalog to make them live on the marketplace storefront."
                  actionLabel="Create Product"
                  onAction={() => setShowProductModal(true)}
                />
              ) : productViewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/60 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all p-3.5 space-y-3"
                    >
                      <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800'}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute top-2 right-2">
                          <Tooltip
                            content={
                              p.status === 'PUBLISHED'
                                ? 'Live on marketplace'
                                : p.status === 'PENDING_REVIEW'
                                ? 'Awaiting admin approval'
                                : 'Rejected by moderation'
                            }
                          >
                            <Badge
                              variant={
                                p.status === 'PUBLISHED'
                                  ? 'success'
                                  : p.status === 'PENDING_REVIEW'
                                  ? 'warning'
                                  : 'danger'
                              }
                              size="sm"
                              dot
                            >
                              {p.status}
                            </Badge>
                          </Tooltip>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">SKU: {p.sku}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <span className="font-extrabold text-slate-900 dark:text-white font-mono">
                          {formatMoney(p.basePricePaise)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Stock: {p.inventoryTotal || p.variants?.[0]?.inventoryQuantity || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Stock</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-3 flex items-center gap-3">
                            <img
                              src={p.images?.[0] || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800'}
                              alt={p.name}
                              className="w-10 h-10 rounded-lg object-cover"
                              width={40}
                              height={40}
                              loading="lazy"
                            />
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-xs">
                              {p.name}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500">{p.sku}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            {formatMoney(p.basePricePaise)}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                            {p.inventoryTotal || p.variants?.[0]?.inventoryQuantity || 0}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                p.status === 'PUBLISHED'
                                  ? 'success'
                                  : p.status === 'PENDING_REVIEW'
                                  ? 'warning'
                                  : 'danger'
                              }
                              size="sm"
                            >
                              {p.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FINANCIALS & PAYOUTS */}
          {activeTab === 'financials' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Vendor Escrow & Financial Ledger
                  </h3>
                  <p className="text-xs text-slate-400">
                    Real-time double-entry settlement balance and payout processing
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSimulatePayout}
                  leftIcon={<ArrowUpRight className="w-4 h-4" />}
                >
                  Request Payout
                </Button>
              </div>

              {payoutSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{payoutSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Available For Transfer</span>
                  <p className="text-xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatMoney(balance?.availablePaise || 0)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Pending Escrow</span>
                  <p className="text-xl font-mono font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                    {formatMoney(balance?.pendingPaise || 0)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Lifetime Paid Out</span>
                  <p className="text-xl font-mono font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                    {formatMoney(balance?.paidOutPaise || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ship Order Modal / Side Panel */}
      <Modal
        isOpen={!!fulfillingOrder}
        onClose={() => setFulfillingOrder(null)}
        title="Fulfill & Ship Suborder"
        description="Provide the carrier dispatch details and tracking number to update the customer."
        maxWidth="md"
      >
        {fulfillingOrder && (
          <form onSubmit={handleFulfillSubmit} className="space-y-4 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Order: {fulfillingOrder.order_number || fulfillingOrder.id}
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Ship to: {fulfillingOrder.customer_name} ({fulfillingOrder.shippingAddress?.city || 'Standard'})
              </p>
            </div>

            <Select
              label="Shipping Carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              options={[
                { value: 'FedEx Express', label: 'FedEx Express' },
                { value: 'UPS Worldwide', label: 'UPS Worldwide' },
                { value: 'DHL Express', label: 'DHL Express' },
                { value: 'USPS Priority', label: 'USPS Priority Mail' },
              ]}
            />

            <Input
              label="Tracking Number"
              placeholder="e.g. 9400 1000 0000 0000 0000 00"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              required
            />

            <div className="flex justify-end gap-2.5 pt-3">
              <Button
                variant="ghost"
                size="md"
                type="button"
                onClick={() => setFulfillingOrder(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                loading={isFulfilling}
                disabled={!trackingNumber.trim()}
              >
                Confirm Shipment
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Product Drawer */}
      <Drawer
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title="Add New Merchandise"
        description="Submit a new product listing to the multi-vendor marketplace."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateProductSubmit} className="space-y-4">
          <Input
            label="Product Title"
            placeholder="e.g. Premium Noise-Cancelling Headphones"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            required
          />

          <Select
            label="Category"
            value={prodCategoryId}
            onChange={(e) => setProdCategoryId(e.target.value)}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price (Cents)"
              type="number"
              value={prodPrice}
              onChange={(e) => setProdPrice(Number(e.target.value))}
              helperText={`Displays as ${formatMoney(prodPrice)}`}
              required
            />
            <Input
              label="Initial Stock"
              type="number"
              value={prodStock}
              onChange={(e) => setProdStock(Number(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SKU Code"
              placeholder="e.g. AUD-NC-001"
              value={prodSku}
              onChange={(e) => setProdSku(e.target.value)}
            />
            <Input
              label="Brand Name"
              placeholder="e.g. ApexAudio"
              value={prodBrand}
              onChange={(e) => setProdBrand(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              rows={3}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Highlight features, technical specs, and compatibility..."
              value={prodDescription}
              onChange={(e) => setProdDescription(e.target.value)}
            />
          </div>

          <Input
            label="Image URL"
            value={prodImageUrl}
            onChange={(e) => setProdImageUrl(e.target.value)}
          />

          {/* Live Image Preview */}
          {prodImageUrl && (
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
              <img
                src={prodImageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2.5">
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={() => setShowProductModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={isCreatingProduct}
              disabled={!prodName.trim()}
            >
              Publish Listing
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
};
