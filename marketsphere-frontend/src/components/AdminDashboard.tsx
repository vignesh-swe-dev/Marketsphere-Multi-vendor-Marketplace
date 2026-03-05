import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Store, 
  Layers, 
  IndianRupee, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  Plus, 
  Users,
  Search,
  AlertTriangle,
  RotateCcw,
  Download,
  Filter,
  Eye,
  ArrowRight,
  TrendingUp,
  Check,
  RefreshCw,
  Lock,
  AlertCircle
} from 'lucide-react';
import type { Category, CommissionRule } from '../types/index.ts';
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
  EmptyState 
} from './ui/index.ts';
import { 
  apiFetch, 
  fetchAdminUsers, 
  updateAdminUserRole, 
  toggleAdminUserBlock, 
  type AdminUserListItem 
} from '../lib/apiClient.ts';

interface AdminDashboardProps {
  categories: Category[];
  onRefreshData: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  categories,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'applications' | 'users' | 'moderation' | 'commissions' | 'ledger' | 'audit' | 'refunds'>('applications');
  const [analytics, setAnalytics] = useState<any>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<AdminUserListItem[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'CUSTOMER' | 'SELLER' | 'ADMIN'>('ALL');
  const [userActionLoadingId, setUserActionLoadingId] = useState<string | null>(null);
  const [userActionFeedback, setUserActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search queries
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Seller Review Drawer & Rejection Confirmation
  const [selectedSellerReview, setSelectedSellerReview] = useState<any | null>(null);
  const [confirmRejectSellerId, setConfirmRejectSellerId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Missing verifiable business registration paperwork');

  // Product Moderation Preview
  const [previewProduct, setPreviewProduct] = useState<any | null>(null);

  // New Rule Modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleScope, setRuleScope] = useState<'DEFAULT' | 'CATEGORY' | 'SELLER'>('CATEGORY');
  const [ruleTargetId, setRuleTargetId] = useState(categories[0]?.id || '');
  const [rulePercentage, setRulePercentage] = useState(12.0);
  const [ruleDescription, setRuleDescription] = useState('');
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);

  // Live Refund Form Validation
  const [refundOrderId, setRefundOrderId] = useState('');
  const [refundAmountCents, setRefundAmountCents] = useState(0);
  const maxRefundableCents = 15000;
  const [refundReasonText, setRefundReasonText] = useState('');
  const [refundStatusMessage, setRefundStatusMessage] = useState<string | null>(null);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [a, s, m, r, l, aud, u] = await Promise.all([
        apiFetch('/admin/analytics').catch(() => null),
        apiFetch('/admin/sellers').catch(() => ({ sellers: [] })),
        apiFetch('/admin/products/moderation').catch(() => ({ products: [] })),
        apiFetch('/admin/commission-rules').catch(() => ({ rules: [] })),
        apiFetch('/admin/ledger').catch(() => ({ entries: [] })),
        apiFetch('/admin/audit-logs').catch(() => ({ logs: [] })),
        fetchAdminUsers().catch(() => ({ users: [] })),
      ]);

      setAnalytics(a);
      setSellers(s?.sellers || []);
      setPendingProducts(m?.products || []);
      setCommissionRules(r?.rules || []);
      setLedgerEntries(l?.entries || []);
      setAuditLogs(aud?.logs || []);
      setUsersList(u?.users || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'CUSTOMER' | 'SELLER') => {
    setUserActionLoadingId(userId);
    setUserActionFeedback(null);
    try {
      const res = await updateAdminUserRole(userId, newRole);
      setUserActionFeedback({ type: 'success', message: res?.message || `User role updated to ${newRole}` });
      await loadData();
      onRefreshData();
    } catch (err: any) {
      setUserActionFeedback({ type: 'error', message: err?.message || 'Failed to update user role' });
    } finally {
      setUserActionLoadingId(null);
    }
  };

  const handleToggleBlock = async (userId: string) => {
    setUserActionLoadingId(userId);
    setUserActionFeedback(null);
    try {
      const res = await toggleAdminUserBlock(userId);
      setUserActionFeedback({ type: 'success', message: res?.message || 'User status updated' });
      await loadData();
    } catch (err: any) {
      setUserActionFeedback({ type: 'error', message: err?.message || 'Failed to update user status' });
    } finally {
      setUserActionLoadingId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateSellerStatus = async (sellerId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiFetch(`/admin/sellers/${sellerId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          status,
          rejectionReason: status === 'REJECTED' ? rejectReason : undefined 
        }),
      });
      setConfirmRejectSellerId(null);
      setSelectedSellerReview(null);
      loadData();
      onRefreshData();
    } catch (err) {
      console.error('Failed to update seller status:', err);
    }
  };

  const handleModerateProduct = async (productId: string, status: 'PUBLISHED' | 'REJECTED') => {
    try {
      await apiFetch(`/admin/products/${productId}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setPreviewProduct(null);
      loadData();
      onRefreshData();
    } catch (err) {
      console.error('Failed to moderate product:', err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRule(true);
    try {
      await apiFetch('/admin/commission-rules', {
        method: 'POST',
        body: JSON.stringify({
          scope: ruleScope,
          targetId: ruleScope === 'DEFAULT' ? null : ruleTargetId,
          percentageRate: Number(rulePercentage),
          description: ruleDescription || `${ruleScope} commission tier`,
        }),
      });
      setShowRuleModal(false);
      setRuleDescription('');
      loadData();
    } catch (err) {
      console.error('Failed to create rule:', err);
    } finally {
      setIsSubmittingRule(false);
    }
  };

  const handleExecuteRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (refundAmountCents > maxRefundableCents) return;
    setIsProcessingRefund(true);
    try {
      await apiFetch('/admin/refunds', {
        method: 'POST',
        body: JSON.stringify({
          orderId: refundOrderId,
          amountCents: refundAmountCents,
          reason: refundReasonText,
        }),
      });
      setRefundStatusMessage(`Refund of ${formatMoney(refundAmountCents)} successfully written to ledger balance.`);
      loadData();
      onRefreshData();
      setTimeout(() => setRefundStatusMessage(null), 5000);
    } catch (err: any) {
      setRefundStatusMessage(`Error: ${err?.message || 'Refund failed'}`);
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((fieldName) => JSON.stringify(row[fieldName] ?? ''))
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered ledger entries
  const filteredLedger = ledgerEntries.filter((e) => {
    if (!ledgerSearchQuery) return true;
    const q = ledgerSearchQuery.toLowerCase();
    return (
      e.transaction_id?.toLowerCase().includes(q) ||
      e.type?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q)
    );
  });

  // Filtered audit logs
  const filteredAudit = auditLogs.filter((l) => {
    if (!auditSearchQuery) return true;
    const q = auditSearchQuery.toLowerCase();
    return (
      l.action?.toLowerCase().includes(q) ||
      l.target_type?.toLowerCase().includes(q) ||
      l.actor_role?.toLowerCase().includes(q)
    );
  });

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch = !userSearchQuery || 
      u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(userSearchQuery)) ||
      (u.shop?.name && u.shop.name.toLowerCase().includes(userSearchQuery.toLowerCase()));
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const adminTabs = [
    { id: 'applications', label: 'Sellers', count: sellers.filter((s) => s.status === 'PENDING').length },
    { id: 'users', label: 'Users & Roles', count: usersList.length },
    { id: 'moderation', label: 'Moderation Queue', count: pendingProducts.length },
    { id: 'commissions', label: 'Commission Rules', count: commissionRules.length },
    { id: 'ledger', label: 'Ledger Audit' },
    { id: 'refunds', label: 'Refund Engine' },
    { id: 'audit', label: 'System Logs' },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Platform Administration
            </h1>
            <Badge variant="purple" size="sm" dot>
              Admin Master Console
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Vendor governance, marketplace commission hierarchy, double-entry financial ledger
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
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowRuleModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Rule
          </Button>
        </div>
      </div>

      {/* KPI Cards: GMV, Commission revenue, Active sellers, Pending applications */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Gross Merchandise Value"
          value={analytics?.grossSalesPaise || 0}
          isCurrency
          icon={<IndianRupee className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          subtitle="Cumulative platform throughput"
        />
        <KPICard
          title="Commission Revenue"
          value={analytics?.platformCommissionsPaise || 0}
          isCurrency
          icon={<TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
          subtitle="Collected marketplace share"
        />
        <KPICard
          title="Active Sellers"
          value={analytics?.activeSellersCount || sellers.filter((s) => s.status === 'APPROVED').length}
          icon={<Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          subtitle="Verified operational storefronts"
        />
        <KPICard
          title="Pending Applications"
          value={sellers.filter((s) => s.status === 'PENDING').length}
          trend={sellers.filter((s) => s.status === 'PENDING').length > 0 ? "Needs Review" : "Clear"}
          trendPositive={sellers.filter((s) => s.status === 'PENDING').length === 0}
          icon={<Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          subtitle="Awaiting compliance approval"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="overflow-x-auto no-scrollbar">
        <Tabs
          tabs={adminTabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          variant="underline"
        />
      </div>

      {/* TAB 1: SELLERS & APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Seller Accounts & Onboarding Applications
              </h3>
              <p className="text-xs text-slate-400">
                Review merchant KYB credentials, business registration, and tax ID information
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sellers.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {s.business_name}
                      </h4>
                      <p className="text-xs text-slate-400">{s.contact_email}</p>
                    </div>
                  </div>

                  <Badge
                    variant={
                      s.status === 'APPROVED'
                        ? 'success'
                        : s.status === 'PENDING'
                        ? 'warning'
                        : 'danger'
                    }
                    size="sm"
                    dot
                  >
                    {s.status}
                  </Badge>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] font-mono space-y-1 text-slate-600 dark:text-slate-300">
                  <p>Tax ID: <span className="text-slate-900 dark:text-white font-bold">{s.tax_id || '98-7654321'}</span></p>
                  <p>Reg #: <span className="text-slate-900 dark:text-white">{s.business_registration_number || 'REG-US-4820'}</span></p>
                  <p>Phone: {s.contact_phone || '+1 (555) 234-5678'}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSellerReview(s)}
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                  >
                    Inspect
                  </Button>

                  {s.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmRejectSellerId(s.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleUpdateSellerStatus(s.id, 'APPROVED')}
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: USERS & ROLES */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  User Accounts & Role Governance
                </h3>
                <Badge variant="purple" size="sm">
                  1 Sole Admin Invariant
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage user accounts and assign, change, or remove Seller and Customer roles. The single Admin account cannot be altered or duplicated.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadData}
                loading={isLoading}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              >
                Reload Users
              </Button>
            </div>
          </div>

          {/* Feedback alerts */}
          {userActionFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
                userActionFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {userActionFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span className="font-medium">{userActionFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setUserActionFeedback(null)}
                className="hover:opacity-75 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Users</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{usersList.length}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
              <span className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wider">Customers</span>
              <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">
                {usersList.filter((u) => u.role === 'CUSTOMER').length}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Sellers</span>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {usersList.filter((u) => u.role === 'SELLER').length}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50">
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Single Admin</span>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                  {usersList.filter((u) => u.role === 'ADMIN').length} / 1
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded-md">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by name, email, or shop..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {userSearchQuery && (
                <button
                  type="button"
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['ALL', 'CUSTOMER', 'SELLER', 'ADMIN'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setUserRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    userRoleFilter === r
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {r === 'ALL' ? 'All Roles' : r === 'CUSTOMER' ? 'Customers' : r === 'SELLER' ? 'Sellers' : 'Admin'}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Assigned Role</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Joined</th>
                  <th className="p-3.5 text-right">Role & Account Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No user accounts found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isAdmin = user.role === 'ADMIN';
                    const isBusy = userActionLoadingId === user.id;

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* User Identity */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                              isAdmin
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 ring-2 ring-purple-500/20'
                                : user.role === 'SELLER'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {user.fullName ? user.fullName.substring(0, 2) : 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {user.fullName}
                              </p>
                              <p className="text-slate-400 font-mono text-[11px] truncate">
                                {user.email}
                              </p>
                              {user.shop && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  <Store className="w-3 h-3" /> {user.shop.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Current Role */}
                        <td className="p-3.5">
                          {isAdmin ? (
                            <Badge variant="purple" size="sm">
                              <ShieldCheck className="w-3 h-3 mr-1 inline" /> Sole Admin
                            </Badge>
                          ) : user.role === 'SELLER' ? (
                            <Badge variant="success" size="sm">
                              <Store className="w-3 h-3 mr-1 inline" /> Seller
                            </Badge>
                          ) : (
                            <Badge variant="primary" size="sm">
                              <Users className="w-3 h-3 mr-1 inline" /> Customer
                            </Badge>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          {user.isBlocked ? (
                            <Badge variant="danger" size="sm">Blocked</Badge>
                          ) : (
                            <Badge variant="success" size="sm">Active</Badge>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="p-3.5 text-slate-400 font-sans">
                          {formatDate(user.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right">
                          {isAdmin ? (
                            <div className="inline-flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300 font-medium bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                              <Lock className="w-3.5 h-3.5" />
                              <span>Primary Administrator (Protected)</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-2">
                              {user.role === 'CUSTOMER' ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleRoleChange(user.id, 'SELLER')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 cursor-pointer"
                                  title="Promote customer to Seller role (provisions store)"
                                >
                                  <Store className="w-3.5 h-3.5" />
                                  <span>Make Seller</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleRoleChange(user.id, 'CUSTOMER')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50 cursor-pointer"
                                  title="Demote seller to standard Customer role"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  <span>Make Customer</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleToggleBlock(user.id)}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 cursor-pointer ${
                                  user.isBlocked
                                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                                title={user.isBlocked ? 'Unblock user' : 'Block user'}
                              >
                                {user.isBlocked ? 'Unblock' : 'Block'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MODERATION QUEUE */}
      {activeTab === 'moderation' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Product Moderation Queue
              </h3>
              <p className="text-xs text-slate-400">
                Inspect merchant listings before they are published to customer storefronts
              </p>
            </div>
            <Badge variant="warning" size="sm">
              {pendingProducts.length} Pending
            </Badge>
          </div>

          {pendingProducts.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="w-8 h-8" />}
              title="Moderation queue is clean"
              description="No vendor listings currently require compliance or review."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pendingProducts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={p.images?.[0] || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800'}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2">
                      <Badge variant="warning" size="sm">Review Required</Badge>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                      {p.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Vendor ID: {p.sellerId} • SKU: {p.sku}
                    </p>
                    <p className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-1">
                      {formatMoney(p.basePricePaise)}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleModerateProduct(p.id, 'REJECTED')}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleModerateProduct(p.id, 'PUBLISHED')}
                    >
                      Approve Listing
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMMISSION RULES (Showing Precedence Hierarchy) */}
      {activeTab === 'commissions' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Multi-Tier Commission Rule Hierarchy
              </h3>
              <p className="text-xs text-slate-400">
                Evaluation engine checks precedence: <strong>1. Seller VIP &gt; 2. Category Tier &gt; 3. Marketplace Default</strong>
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowRuleModal(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Commission Rule
            </Button>
          </div>

          {/* Visual Precedence Hierarchy Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-purple-600 font-mono">Priority 1 (Highest)</span>
                <Badge variant="purple" size="sm">SELLER</Badge>
              </div>
              <p className="font-bold text-xs text-slate-900 dark:text-white">Seller VIP Override</p>
              <p className="text-[11px] text-slate-400">Negotiated per-vendor contract rates (e.g. 8.0%)</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-blue-600 font-mono">Priority 2</span>
                <Badge variant="primary" size="sm">CATEGORY</Badge>
              </div>
              <p className="font-bold text-xs text-slate-900 dark:text-white">Category Tier Rate</p>
              <p className="text-[11px] text-slate-400">Rates mapped to categories (Electronics 10%, Apparel 15%)</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Priority 3 (Baseline)</span>
                <Badge variant="neutral" size="sm">DEFAULT</Badge>
              </div>
              <p className="font-bold text-xs text-slate-900 dark:text-white">Marketplace Default</p>
              <p className="text-[11px] text-slate-400">Default fee applied when no higher rule matches (12.0%)</p>
            </div>
          </div>

          {/* Rules Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3">Scope & Priority</th>
                  <th className="py-3 px-3">Target Details</th>
                  <th className="py-3 px-3">Commission Rate</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {commissionRules.map((r) => {
                  const targetDetails = r.targetId || (r as any).target_id || 'Marketplace Wide';
                  const rate = ((r.percentageRate ?? (r as any).percentage_rate) || 0).toFixed(1);
                  const effectiveDate = r.effectiveDate || (r as any).effective_date;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            r.scope === 'SELLER'
                              ? 'purple'
                              : r.scope === 'CATEGORY'
                              ? 'primary'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {r.scope} (P{r.scope === 'SELLER' ? '1' : r.scope === 'CATEGORY' ? '2' : '3'})
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {targetDetails}
                      </td>
                      <td className="py-3 px-3 font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                        {rate}%
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {r.description}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {formatDate(effectiveDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DOUBLE-ENTRY LEDGER AUDIT */}
      {activeTab === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Append-Only Double-Entry Financial Ledger
              </h3>
              <p className="text-xs text-slate-400">
                Mathematical guarantee: <code>Debits == Credits</code>. Entries are append-only.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search ledger entries..."
                  value={ledgerSearchQuery}
                  onChange={(e) => setLedgerSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none"
                />
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadCSV(ledgerEntries, 'marketsphere-ledger')}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Debit (₹)</th>
                  <th className="p-3 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {filteredLedger.map((e, idx) => (
                  <tr
                    key={e.id || idx}
                    className={`${
                      idx % 2 === 0
                        ? 'bg-white dark:bg-slate-900'
                        : 'bg-slate-50/40 dark:bg-slate-800/30'
                    } hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors`}
                  >
                    <td className="p-3 text-slate-400 font-sans">{formatDate(e.created_at || e.createdAt)}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 truncate max-w-[130px]">{e.transaction_id || e.transactionId}</td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{e.type}</td>
                    <td className="p-3 font-sans text-slate-600 dark:text-slate-300 max-w-xs truncate">{e.description}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100 text-right">
                      {(e.debitPaise ?? e.debitCents ?? 0) > 0 ? formatMoney(e.debitPaise ?? e.debitCents) : '-'}
                    </td>
                    <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400 text-right">
                      {(e.creditPaise ?? e.creditCents ?? 0) > 0 ? formatMoney(e.creditPaise ?? e.creditCents) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: REFUND ENGINE */}
      {activeTab === 'refunds' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Financial Refund Engine & Validation
            </h3>
            <p className="text-xs text-slate-400">
              Live validation enforces that refund amounts do not exceed the captured transaction suborder
            </p>
          </div>

          {refundStatusMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{refundStatusMessage}</span>
            </div>
          )}

          <form onSubmit={handleExecuteRefund} className="max-w-xl space-y-4">
            <Input
              label="Order ID / Transaction Reference"
              placeholder="e.g. ord-1718293021-9a1b"
              value={refundOrderId}
              onChange={(e) => setRefundOrderId(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Refund Amount (Cents)
              </label>
              <input
                type="number"
                value={refundAmountCents}
                onChange={(e) => setRefundAmountCents(Number(e.target.value))}
                max={maxRefundableCents}
                className={`w-full min-h-[44px] rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 outline-none font-mono ${
                  refundAmountCents > maxRefundableCents
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'
                }`}
              />
              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="text-slate-500 font-mono">
                  Displays: <strong>{formatMoney(refundAmountCents)}</strong>
                </span>
                <span className="text-slate-400 font-mono">
                  Max refundable: <strong>{formatMoney(maxRefundableCents)}</strong>
                </span>
              </div>
              {refundAmountCents > maxRefundableCents && (
                <p className="text-xs font-semibold text-rose-500">
                  Amount exceeds maximum captured order balance!
                </p>
              )}
            </div>

            <Select
              label="Dispute Category"
              value={refundReasonText}
              onChange={(e) => setRefundReasonText(e.target.value)}
              options={[
                { value: 'Customer satisfaction dispute resolution', label: 'Customer satisfaction dispute resolution' },
                { value: 'Item arrived damaged or defective', label: 'Item arrived damaged or defective' },
                { value: 'Order cancelled before dispatch', label: 'Order cancelled before dispatch' },
                { value: 'Regulatory fraud prevention chargeback', label: 'Regulatory fraud prevention chargeback' },
              ]}
            />

            <div className="pt-2">
              <Button
                variant="danger"
                size="md"
                type="submit"
                loading={isProcessingRefund}
                disabled={refundAmountCents > maxRefundableCents || refundAmountCents <= 0}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Execute Reversal & Update Ledger
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Immutable System Security & Governance Logs
              </h3>
              <p className="text-xs text-slate-400">
                Audit trail recording all role escalations, payouts, and moderation decisions
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search audit trail..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none"
                />
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadCSV(auditLogs, 'marketsphere-audit-trail')}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {filteredAudit.map((log, idx) => (
                  <tr
                    key={log.id || idx}
                    className={`${
                      idx % 2 === 0
                        ? 'bg-white dark:bg-slate-900'
                        : 'bg-slate-50/40 dark:bg-slate-800/30'
                    } hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`}
                  >
                    <td className="p-3 text-slate-400 font-sans">{formatDate(log.timestamp)}</td>
                    <td className="p-3">
                      <Badge variant="neutral" size="sm">{log.actor_role}</Badge>
                    </td>
                    <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">{log.action}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-sans">
                      {log.target_type} ({log.target_id})
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 truncate max-w-xs font-mono text-[10px]">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seller Application Review Drawer */}
      <Drawer
        isOpen={!!selectedSellerReview}
        onClose={() => setSelectedSellerReview(null)}
        title="Seller KYB Dossier"
        description="Inspect vendor legal credentials and compliance information."
        maxWidth="max-w-md"
      >
        {selectedSellerReview && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Business Entity</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedSellerReview.business_name}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Contact Email</span>
                <p className="text-slate-600 dark:text-slate-300 font-mono">
                  {selectedSellerReview.contact_email}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Tax ID Number</span>
                <p className="text-slate-900 dark:text-white font-mono font-bold">
                  {selectedSellerReview.tax_id || '98-7654321'}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Registration Number</span>
                <p className="text-slate-900 dark:text-white font-mono">
                  {selectedSellerReview.business_registration_number || 'REG-US-4820'}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Disbursement Bank</span>
                <p className="text-slate-900 dark:text-white font-mono">
                  JPMorgan Chase (****4820)
                </p>
              </div>
            </div>

            {selectedSellerReview.status === 'PENDING' && (
              <div className="flex gap-2.5 pt-4">
                <Button
                  variant="danger"
                  fullWidth
                  size="md"
                  onClick={() => setConfirmRejectSellerId(selectedSellerReview.id)}
                >
                  Reject
                </Button>
                <Button
                  variant="success"
                  fullWidth
                  size="md"
                  onClick={() => handleUpdateSellerStatus(selectedSellerReview.id, 'APPROVED')}
                >
                  Approve Application
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Confirmation Dialog for Rejecting Seller */}
      <Modal
        isOpen={!!confirmRejectSellerId}
        onClose={() => setConfirmRejectSellerId(null)}
        title="Confirm Application Rejection"
        description="Provide a justification reason which will be returned to the applicant."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <Input
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2.5 pt-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setConfirmRejectSellerId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => {
                if (confirmRejectSellerId) {
                  handleUpdateSellerStatus(confirmRejectSellerId, 'REJECTED');
                }
              }}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Commission Rule Modal */}
      <Modal
        isOpen={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title="Create Commission Rule"
        description="Define a tiered platform rake rate according to the precedence hierarchy."
        maxWidth="md"
      >
        <form onSubmit={handleCreateRule} className="space-y-4 pt-2">
          <Select
            label="Rule Scope & Priority"
            value={ruleScope}
            onChange={(e) => setRuleScope(e.target.value as any)}
            options={[
              { value: 'SELLER', label: 'SELLER (Priority 1 - VIP Override)' },
              { value: 'CATEGORY', label: 'CATEGORY (Priority 2 - Category Tier)' },
              { value: 'DEFAULT', label: 'DEFAULT (Priority 3 - Marketplace Default Rate)' },
            ]}
          />

          {ruleScope === 'CATEGORY' && (
            <Select
              label="Target Category"
              value={ruleTargetId}
              onChange={(e) => setRuleTargetId(e.target.value)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}

          {ruleScope === 'SELLER' && (
            <Input
              label="Target Seller ID"
              placeholder="e.g. seller-prof-1"
              value={ruleTargetId}
              onChange={(e) => setRuleTargetId(e.target.value)}
              required
            />
          )}

          <Input
            label="Percentage Fee (%)"
            type="number"
            step="0.1"
            value={rulePercentage}
            onChange={(e) => setRulePercentage(Number(e.target.value))}
            required
          />

          <Input
            label="Description / Label"
            placeholder="e.g. Standard Electronics Take Rate"
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
          />

          <div className="flex justify-end gap-2.5 pt-3">
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={() => setShowRuleModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={isSubmittingRule}
            >
              Save Rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
