import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  Truck, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Lock, 
  Store,
  Layers,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  Building2,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CartItem, User, Address, Order } from '../types/index.ts';
import { formatMoney } from '../lib/formatters.ts';
import { Modal, Button, Badge, Input, PriceTag } from './ui/index.ts';
import { apiFetch } from '../lib/apiClient.ts';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  items: CartItem[];
  couponCode: string;
  onOrderSuccess: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  items,
  couponCode,
  onOrderSuccess,
}) => {
  const [step, setStep] = useState<'address' | 'payment' | 'review' | 'processing' | 'success'>('address');
  const [address, setAddress] = useState<Address>({
    id: 'addr-active',
    userId: currentUser?.id || 'guest',
    fullName: currentUser?.fullName || '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    isDefault: true,
  });

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [simulatedSuccess, setSimulatedSuccess] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Checks the shipping address before moving on. The server checks it again.
  const validateAddress = (): string | null => {
    if (address.fullName.trim().length < 2) return 'Enter the recipient name.';
    if (address.streetAddress.trim().length < 5) return 'Enter the street address (house number, building, area).';
    if (!address.city.trim()) return 'Enter the city.';
    if (!address.state.trim()) return 'Enter the state.';
    if (!/^[1-9][0-9]{5}$/.test(address.postalCode.trim())) return 'Enter a valid 6-digit PIN code, for example 560001.';
    const phone = (address.phone || '').replace(/[\s-]/g, '');
    if (!/^(?:\+91)?[6-9]\d{9}$/.test(phone)) return 'Enter a valid 10-digit Indian mobile number.';
    return null;
  };

  const goToPayment = () => {
    const problem = validateAddress();
    if (problem) {
      setErrorMsg(problem);
      return;
    }
    setErrorMsg(null);
    setStep('payment');
  };
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // Group items by vendor
  const sellerGroups: Record<string, { shopName: string; items: CartItem[]; subtotal: number }> = {};
  for (const item of items) {
    const sId = item.product.sellerId;
    if (!sellerGroups[sId]) {
      sellerGroups[sId] = {
        shopName: item.product.shopName || 'Boutique Merchant',
        items: [],
        subtotal: 0,
      };
    }
    const price = item.selectedVariant ? item.selectedVariant.pricePaise : item.product.basePricePaise;
    sellerGroups[sId].items.push(item);
    sellerGroups[sId].subtotal += price * item.quantity;
  }

  const sellerCount = Object.keys(sellerGroups).length;
  const itemsSubtotalCents = items.reduce((sum, it) => {
    const price = it.selectedVariant ? it.selectedVariant.pricePaise : it.product.basePricePaise;
    return sum + price * it.quantity;
  }, 0);

  const discountCents = couponCode === 'WELCOME10' 
    ? Math.round(itemsSubtotalCents * 0.1) 
    : couponCode === 'SAVE25' ? 2500 : 0;

  const shippingCents = sellerCount * 500;
  const estimatedTaxCents = Math.round(Math.max(0, itemsSubtotalCents - discountCents) * 0.08);
  const grandTotalCents = Math.max(0, itemsSubtotalCents - discountCents + shippingCents + estimatedTaxCents);

  // Card input formatters
  const handleCardNumberChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  };

  const handleExpiryChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      setExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setExpiry(digits);
    }
  };

  const handleCvvChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    setCvv(digits);
  };

  const handleCreateAndPay = async () => {
    setErrorMsg(null);
    setStep('processing');

    try {
      // 1. Create order and get payment session from Express backend
      const data = await apiFetch<{ order: any }>('/checkout/order', {
        method: 'POST',
        body: JSON.stringify({
          shippingAddress: address,
          items: items.map((it) => ({
            productId: it.product.id,
            variantId: it.selectedVariant?.id,
            quantity: it.quantity,
          })),
          couponCode,
          paymentMethod: 'SANDBOX_CARD_4242',
        }),
      });

      const { order } = data;
      const { paymentSession } = order;

      // 2. Execute Payment Verification & Capture on Backend
      const captureData = await apiFetch<{ success: boolean; message?: string }>('/payments/verify-and-capture', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          providerPaymentId: paymentSession.providerPaymentId,
          simulatedSuccess,
        }),
      });

      if (!captureData.success) {
        throw new Error(captureData.message || 'Payment authorization was declined');
      }

      // 3. Fetch completed full order details
      const fullOrderData = await apiFetch<{ order: Order }>(`/orders/${order.id}`);

      setCompletedOrder(fullOrderData.order);
      setStep('success');
      onOrderSuccess(fullOrderData.order);
    } catch (err: any) {
      setErrorMsg(err.message || 'Checkout encountered an error');
      setStep('payment');
    }
  };

  const stepsList = [
    { id: 'address', label: 'Shipping' },
    { id: 'payment', label: 'Payment' },
    { id: 'review', label: 'Review' },
  ];

  const getStepProgress = () => {
    switch (step) {
      case 'address':
        return 33;
      case 'payment':
        return 66;
      case 'review':
        return 100;
      case 'processing':
        return 100;
      case 'success':
        return 100;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (step !== 'processing') onClose();
      }}
      maxWidth="3xl"
      showCloseButton={step !== 'processing'}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Secure Checkout
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Multi-vendor escrow settlement & atomic inventory hold
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stepper Navigation */}
        {step !== 'processing' && step !== 'success' && (
          <div className="relative border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="flex justify-between items-center relative z-10 px-2 sm:px-6">
              {stepsList.map((s, idx) => {
                const isActive = step === s.id;
                const isDone =
                  (step === 'payment' && idx === 0) ||
                  (step === 'review' && idx <= 1);

                return (
                  <div key={s.id} className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : isActive
                          ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/60'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span
                      className={`text-xs mt-1.5 font-semibold ${
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                          : isDone
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Stepper line */}
            <div className="absolute top-4 left-10 right-10 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${getStepProgress()}%` }}
              />
            </div>
          </div>
        )}

        {/* Error notification banner */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Transaction Authorization Error</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Collapsible Mobile Order Summary Bar */}
        {step !== 'processing' && step !== 'success' && (
          <div className="md:hidden border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-slate-50 dark:bg-slate-800/40">
            <button
              type="button"
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-1.5">
                <Store className="w-4 h-4 text-indigo-600" />
                {items.length} items across {sellerCount} vendors
              </span>
              <div className="flex items-center gap-1.5 font-mono text-indigo-600 dark:text-indigo-400">
                <span>{formatMoney(grandTotalCents)}</span>
                {isSummaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isSummaryExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatMoney(itemsSubtotalCents)}</span>
                </div>
                {discountCents > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Discount ({couponCode})</span>
                    <span className="font-mono">-{formatMoney(discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping ({sellerCount} packages)</span>
                  <span className="font-mono">{formatMoney(shippingCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Tax</span>
                  <span className="font-mono">{formatMoney(estimatedTaxCents)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Main Checkout Interaction Column */}
          <div className={`space-y-6 ${step === 'processing' || step === 'success' ? 'md:col-span-12' : 'md:col-span-7'}`}>
            <AnimatePresence mode="wait">
              {/* Step 1: Address */}
              {step === 'address' && (
                <motion.div
                  key="address-step"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Shipping Address
                    </h3>
                    <Badge variant="primary" size="sm">Step 1 of 3</Badge>
                  </div>

                  <div className="space-y-3">
                    <Input
                      label="Recipient Full Name"
                      value={address.fullName}
                      onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                      placeholder="Full name as on the parcel"
                      required
                    />

                    <Input
                      label="Street Address"
                      value={address.streetAddress}
                      onChange={(e) => setAddress({ ...address, streetAddress: e.target.value })}
                      placeholder="House / flat number, building, street, area"
                      required
                    />

                    <Input
                      label="Mobile Number"
                      value={address.phone || ''}
                      onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                      placeholder="10-digit mobile number"
                      inputMode="tel"
                      required
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="City"
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        required
                      />
                      <Input
                        label="State"
                        value={address.state}
                        onChange={(e) => setAddress({ ...address, state: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="PIN Code"
                        value={address.postalCode}
                        onChange={(e) => setAddress({ ...address, postalCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="e.g. 560001"
                        inputMode="numeric"
                        required
                      />
                      <Input
                        label="Country"
                        value={address.country}
                        readOnly
                        required
                      />
                    </div>
                  </div>

                  {/* Multi-Vendor Fulfillment Alert */}
                  <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Multi-Vendor Split Fulfillment ({sellerCount} Independent Shops)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Your items will be dispatched directly from each seller's workshop. You will receive separate tracking links for each parcel.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={goToPayment}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Continue to Payment
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Payment */}
              {step === 'payment' && (
                <motion.div
                  key="payment-step"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Payment Method
                    </h3>
                    <Badge variant="warning" size="sm">Sandbox Gateway</Badge>
                  </div>

                  {/* Payment Options Radio Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all ${
                        paymentMethod === 'card'
                          ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                          {paymentMethod === 'card' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Credit / Debit Card</p>
                        <p className="text-[10px] text-slate-400">Visa, MasterCard, Amex</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all ${
                        paymentMethod === 'wallet'
                          ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Wallet className={`w-5 h-5 ${paymentMethod === 'wallet' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${paymentMethod === 'wallet' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                          {paymentMethod === 'wallet' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Instant Wallet</p>
                        <p className="text-[10px] text-slate-400">Apple Pay / Google Pay</p>
                      </div>
                    </button>
                  </div>

                  {/* Formatted Card Inputs */}
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <Input
                      label="Card Number"
                      value={cardNumber}
                      onChange={(e) => handleCardNumberChange(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      inputMode="numeric"
                      rightIcon={<CreditCard className="w-4 h-4 text-slate-400" />}
                      required
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Expiration"
                        value={expiry}
                        onChange={(e) => handleExpiryChange(e.target.value)}
                        placeholder="MM/YY"
                        inputMode="numeric"
                        required
                      />

                      <Input
                        label="CVC / CVV"
                        value={cvv}
                        onChange={(e) => handleCvvChange(e.target.value)}
                        placeholder="123"
                        inputMode="numeric"
                        required
                      />
                    </div>

                    {/* Sandbox Switch */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">
                        Developer Gateway Simulation:
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="sandbox-status"
                            checked={simulatedSuccess === true}
                            onChange={() => setSimulatedSuccess(true)}
                            className="accent-indigo-600"
                          />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">Successful Capture</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="sandbox-status"
                            checked={simulatedSuccess === false}
                            onChange={() => setSimulatedSuccess(false)}
                            className="accent-rose-600"
                          />
                          <span className="text-rose-600 dark:text-rose-400 font-medium">Simulate Card Decline</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setStep('address')}
                      leftIcon={<ArrowLeft className="w-4 h-4" />}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      className="flex-1"
                      onClick={() => setStep('review')}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Review Order
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Review */}
              {step === 'review' && (
                <motion.div
                  key="review-step"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Final Order Review
                    </h3>
                    <Badge variant="success" size="sm">Step 3 of 3</Badge>
                  </div>

                  {/* Summary of shipping address and card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Shipping To
                      </p>
                      <p className="font-bold text-slate-900 dark:text-white">{address.fullName}</p>
                      <p className="text-slate-600 dark:text-slate-300">{address.streetAddress}</p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {address.city}, {address.state} {address.postalCode}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Payment Method
                      </p>
                      <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        Card ending in {cardNumber.slice(-4) || '4242'}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">Exp: {expiry}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                        Escrow reservation active
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-3">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setStep('payment')}
                      leftIcon={<ArrowLeft className="w-4 h-4" />}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      shine
                      className="flex-1"
                      onClick={handleCreateAndPay}
                      leftIcon={<Lock className="w-4 h-4" />}
                    >
                      Authorize & Pay {formatMoney(grandTotalCents)}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Processing State */}
              {step === 'processing' && (
                <motion.div
                  key="processing-step"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 text-center space-y-4"
                >
                  <div className="relative w-16 h-16 mx-auto">
                    <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                    <Lock className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Processing Escrow Settlement
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Authorizing payment gateway session, locking inventory allocations, and dispatching vendor suborders...
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Success Screen */}
              {step === 'success' && completedOrder && (
                <motion.div
                  key="success-step"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-6 text-center space-y-6"
                >
                  <div className="relative w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xl ring-8 ring-emerald-50 dark:ring-emerald-950/30">
                    <CheckCircle2 className="w-10 h-10" />
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.4, 0], opacity: [1, 0.8, 0] }}
                      transition={{ duration: 1, repeat: 1 }}
                      className="absolute inset-0 rounded-full border-2 border-emerald-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <Badge variant="success" size="md">
                      Payment Verified & Captured
                    </Badge>
                    <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white pt-2">
                      Order Confirmed!
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Order Reference: <strong className="text-slate-900 dark:text-white font-mono">{completedOrder.orderNumber}</strong>
                    </p>
                  </div>

                  {/* Suborders Dispatched Breakdown */}
                  <div className="text-left bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
                      <span>Vendor Suborders Dispatched ({completedOrder.sellerOrders.length})</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                        Ready for Fulfillment
                      </span>
                    </h4>

                    <div className="space-y-2">
                      {completedOrder.sellerOrders.map((so) => (
                        <div
                          key={so.id}
                          className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>{so.shopName}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {so.items.length} {so.items.length === 1 ? 'item' : 'items'} • Net Payable: {formatMoney(so.sellerNetPayablePaise)}
                            </p>
                          </div>
                          <Badge variant="warning" size="sm">
                            {so.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={onClose}
                  >
                    View Order Details
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Persistent Order Summary Column (Desktop) */}
          {step !== 'processing' && step !== 'success' && (
            <div className="hidden md:block md:col-span-5 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-slate-400 text-[11px]">{items.length} items</span>
              </h4>

              {/* Items scroll */}
              <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
                {items.map((it) => {
                  const price = it.selectedVariant ? it.selectedVariant.pricePaise : it.product.basePricePaise;
                  const img = it.product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

                  return (
                    <div key={it.id} className="flex items-center gap-3 text-xs">
                      <img
                        src={img}
                        alt={it.product.name}
                        className="w-12 h-12 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                        width={48}
                        height={48}
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {it.product.name}
                        </p>
                        <p className="text-[11px] text-slate-400">Qty: {it.quantity}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatMoney(price * it.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Items Subtotal</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">
                    {formatMoney(itemsSubtotalCents)}
                  </span>
                </div>

                {discountCents > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Coupon ({couponCode})</span>
                    <span className="font-mono">-{formatMoney(discountCents)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Vendor Shipping ({sellerCount} pkgs)</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">
                    {formatMoney(shippingCents)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Estimated Tax</span>
                  <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">
                    {formatMoney(estimatedTaxCents)}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-2.5 border-t border-slate-200 dark:border-slate-700 text-sm font-extrabold text-slate-900 dark:text-white">
                  <span>Grand Total</span>
                  <span className="text-base font-mono text-indigo-600 dark:text-indigo-400">
                    {formatMoney(grandTotalCents)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
