import React, { useState } from 'react';
import { 
  Package, 
  Store, 
  Truck, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  Star,
  ChevronDown,
  ChevronUp,
  MapPin,
  RefreshCw,
  CreditCard
} from 'lucide-react';
import type { Order, User, SellerOrder } from '../types/index.ts';
import { formatMoney, formatDate } from '../lib/formatters.ts';
import { Button, IconButton, Badge, EmptyState, Tabs, Modal, Select } from './ui/index.ts';
import { OrderStatusTracker } from './OrderStatusTracker.tsx';

interface CustomerOrdersProps {
  orders: Order[];
  currentUser: User | null;
  onRefreshOrders: () => void;
  onRequestRefund: (orderId: string, sellerOrderId?: string, amountCents?: number, reason?: string) => Promise<void>;
  onOpenReviewModal: (productId: string) => void;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({
  orders,
  currentUser: _currentUser,
  onRefreshOrders,
  onRequestRefund,
  onOpenReviewModal,
}) => {
  const [activeFilterTab, setActiveFilterTab] = useState('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(orders[0]?.id || null);
  const [selectedTrackingSuborder, setSelectedTrackingSuborder] = useState<SellerOrder | null>(null);
  const [refundModalOrder, setRefundModalOrder] = useState<{ orderId: string; sellerOrderId?: string; totalPaise: number } | null>(null);
  const [refundReason, setRefundReason] = useState('Item arrived damaged or defective');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshOrders();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalOrder) return;
    setIsSubmittingRefund(true);
    setRefundError(null);
    try {
      await onRequestRefund(
        refundModalOrder.orderId,
        refundModalOrder.sellerOrderId,
        refundModalOrder.totalPaise,
        refundReason
      );
      setRefundModalOrder(null);
      onRefreshOrders();
    } catch (err: any) {
      setRefundError(err?.message || 'Failed to submit refund request');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  // Filter orders based on active tab
  const filteredOrders = orders.filter((order) => {
    if (activeFilterTab === 'ALL') return true;
    if (activeFilterTab === 'ACTIVE') {
      return ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED'].includes(order.status);
    }
    if (activeFilterTab === 'DELIVERED') return order.status === 'DELIVERED';
    if (activeFilterTab === 'CANCELLED') {
      return ['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_REQUESTED'].includes(order.status);
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge variant="success" dot>{status}</Badge>;
      case 'SHIPPED':
      case 'PROCESSING':
      case 'PAID':
        return <Badge variant="primary" dot>{status}</Badge>;
      case 'CANCELLED':
      case 'REFUNDED':
        return <Badge variant="danger">{status}</Badge>;
      case 'REFUND_REQUESTED':
      case 'PENDING_PAYMENT':
        return <Badge variant="warning">{status}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const tabsList = [
    { id: 'ALL', label: 'All Orders', count: orders.length },
    {
      id: 'ACTIVE',
      label: 'Active',
      count: orders.filter((o) => ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED'].includes(o.status)).length,
    },
    {
      id: 'DELIVERED',
      label: 'Delivered',
      count: orders.filter((o) => o.status === 'DELIVERED').length,
    },
    {
      id: 'CANCELLED',
      label: 'Cancelled & Returns',
      count: orders.filter((o) => ['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_REQUESTED'].includes(o.status)).length,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Customer Orders & Deliveries
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track shipments, download invoices, request returns, or leave seller feedback
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          loading={isRefreshing}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
        >
          Refresh Orders
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="pt-1">
        <Tabs
          tabs={tabsList}
          activeTab={activeFilterTab}
          onChange={setActiveFilterTab}
          variant="pill"
        />
      </div>

      {/* Orders List / Empty State */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title={orders.length === 0 ? "No orders placed yet" : "No orders found for this filter"}
          description={
            orders.length === 0
              ? "Your purchases from independent shops will appear here once placed."
              : "Try switching to another tab to view your past purchases."
          }
          actionLabel={orders.length === 0 ? "Explore Marketplace" : "Show All Orders"}
          onAction={() => setActiveFilterTab('ALL')}
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  className="p-5 sm:p-6 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                        Order Number
                      </span>
                      <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                        {order.orderNumber}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                        Date Placed
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                        Total Paid
                      </span>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                        {formatMoney(order.totalPaise)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(order.status)}

                    <IconButton
                      variant="default"
                      size="sm"
                      aria-label={isExpanded ? 'Collapse order details' : 'Expand order details'}
                      className="w-8 h-8 min-w-[32px] min-h-[32px] pointer-events-none"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </IconButton>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 space-y-6">
                    {/* Destination & Payment Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          Delivery Address:
                        </span>
                        <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {order.shippingAddress?.fullName}
                          <br />
                          {order.shippingAddress?.streetAddress}
                          <br />
                          {order.shippingAddress?.city}, {order.shippingAddress?.state}{' '}
                          {order.shippingAddress?.postalCode}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          Payment Breakdown:
                        </span>
                        <p className="text-slate-500 dark:text-slate-400">
                          Method: <strong className="text-slate-800 dark:text-slate-200 font-mono">{order.paymentMethod}</strong>
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 font-mono">
                          Subtotal: {formatMoney(order.subtotalPaise)} • Shipping: {formatMoney(order.shippingPaise)} • Tax: {formatMoney(order.taxPaise)}
                        </p>
                        {order.discountPaise > 0 && (
                          <p className="text-emerald-600 dark:text-emerald-400 font-medium font-mono">
                            Coupon Discount: -{formatMoney(order.discountPaise)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Suborders Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Packages & Fulfillment ({order.sellerOrders.length} Independent Suborders)
                      </h4>

                      <div className="space-y-4">
                        {order.sellerOrders.map((sOrder) => (
                          <div
                            key={sOrder.id}
                            className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 bg-white dark:bg-slate-900"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                  <Store className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                  {sOrder.shopName}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {getStatusBadge(sOrder.status)}

                                {sOrder.trackingNumber ? (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setSelectedTrackingSuborder(sOrder)}
                                    leftIcon={<Truck className="w-3.5 h-3.5" />}
                                  >
                                    Track: {sOrder.shippingCarrier || 'Dispatch'}
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">
                                    Awaiting dispatch
                                  </span>
                                )}

                                {order.status !== 'REFUNDED' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setRefundModalOrder({
                                        orderId: order.id,
                                        sellerOrderId: sOrder.id,
                                        totalPaise: sOrder.totalPaise,
                                      })
                                    }
                                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                                    className="text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
                                  >
                                    Request refund
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Item Snapshots */}
                            <div className="space-y-2.5">
                              {sOrder.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <img
                                      src={
                                        item.imageUrl ||
                                        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'
                                      }
                                      alt={item.productName}
                                      className="w-12 h-12 rounded-xl object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                                      width={48}
                                      height={48}
                                      loading="lazy"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                        {item.productName}
                                      </p>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                        Qty: {item.quantity} • {item.variantName || 'Standard'} • SKU: {item.sku}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                                      {formatMoney(item.totalPaise)}
                                    </span>

                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => onOpenReviewModal(item.productId)}
                                      leftIcon={<Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
                                      className="text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                    >
                                      Review
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tracking Modal with OrderStatusTracker */}
      <Modal
        isOpen={!!selectedTrackingSuborder}
        onClose={() => setSelectedTrackingSuborder(null)}
        title={
          selectedTrackingSuborder ? (
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{selectedTrackingSuborder.shopName} Shipment</span>
            </div>
          ) : undefined
        }
        description="Live delivery milestone timeline and tracking information"
        maxWidth="lg"
      >
        {selectedTrackingSuborder && (
          <div className="space-y-6 pt-2">
            <OrderStatusTracker
              status={selectedTrackingSuborder.status}
              carrier={selectedTrackingSuborder.shippingCarrier}
              trackingNumber={selectedTrackingSuborder.trackingNumber}
              shippedAt={selectedTrackingSuborder.shippedAt}
              deliveredAt={selectedTrackingSuborder.deliveredAt}
            />
            <Button
              variant="secondary"
              fullWidth
              size="md"
              onClick={() => setSelectedTrackingSuborder(null)}
            >
              Close Tracker
            </Button>
          </div>
        )}
      </Modal>

      {/* Refund Request Modal */}
      <Modal
        isOpen={!!refundModalOrder}
        onClose={() => {
          setRefundModalOrder(null);
          setRefundError(null);
        }}
        title="Request Refund"
        description="Your refund request will be reviewed by platform administrators."
        maxWidth="md"
      >
        {refundModalOrder && (
          <form onSubmit={handleRefundSubmit} className="space-y-4 pt-2">
            {refundError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {refundError}
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p className="text-slate-500 dark:text-slate-400">Eligible refund amount:</p>
              <p className="text-lg font-mono font-extrabold text-slate-900 dark:text-white">
                {formatMoney(refundModalOrder.totalPaise)}
              </p>
            </div>

            <Select
              label="Reason for Request"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              options={[
                { value: 'Item arrived damaged or defective', label: 'Item arrived damaged or defective' },
                { value: 'Changed mind / 30-day inspection return', label: 'Changed mind / 30-day inspection return' },
                { value: 'Did not arrive within fulfillment SLA', label: 'Did not arrive within fulfillment SLA' },
                { value: 'Incorrect variant or SKU dispatched', label: 'Incorrect variant or SKU dispatched' },
              ]}
            />

            <div className="flex justify-end gap-2.5 pt-3">
              <Button
                variant="ghost"
                size="md"
                type="button"
                onClick={() => {
                  setRefundModalOrder(null);
                  setRefundError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                type="submit"
                loading={isSubmittingRefund}
              >
                Request refund
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
