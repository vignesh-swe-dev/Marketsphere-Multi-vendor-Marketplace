import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Package, 
  Truck, 
  MapPin, 
  Copy, 
  Check, 
  AlertTriangle, 
  XCircle,
  ExternalLink
} from 'lucide-react';
import type { OrderStatus, SellerOrder } from '../types/index.ts';
import { formatDate } from '../lib/formatters.ts';
import { Badge, IconButton } from './ui/index.ts';

export interface OrderStatusTrackerProps {
  status: OrderStatus;
  carrier?: string;
  trackingNumber?: string;
  createdAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  className?: string;
}

export const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = ({
  status,
  carrier,
  trackingNumber,
  createdAt,
  shippedAt,
  deliveredAt,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!trackingNumber) return;
    try {
      navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const isCancelled = status === 'CANCELLED';
  const isRefunded = status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED' || status === 'REFUND_REQUESTED';

  const steps = [
    { key: 'PLACED', label: 'Order Placed', icon: Clock, timestamp: createdAt },
    { key: 'PAID', label: 'Payment Confirmed', icon: CheckCircle2, timestamp: createdAt },
    { key: 'PACKED', label: 'Packed & Ready', icon: Package, timestamp: createdAt },
    { key: 'SHIPPED', label: 'In Transit', icon: Truck, timestamp: shippedAt },
    { key: 'DELIVERED', label: 'Delivered', icon: MapPin, timestamp: deliveredAt },
  ];

  const getStepIndex = (st: OrderStatus): number => {
    switch (st) {
      case 'PENDING_PAYMENT':
        return 0;
      case 'PAID':
        return 1;
      case 'PROCESSING':
        return 2;
      case 'SHIPPED':
        return 3;
      case 'DELIVERED':
        return 4;
      default:
        return 1;
    }
  };

  const currentStepIdx = getStepIndex(status);

  if (isCancelled || isRefunded) {
    return (
      <div className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 ${className}`}>
        <div className="flex items-center gap-3">
          {isCancelled ? (
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {isCancelled ? 'Order Cancelled' : 'Refund Issued / In Review'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isCancelled
                ? 'This order was voided and any authorized charges have been released.'
                : 'A refund has been credited back to the original payment method.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Carrier & Tracking Bar */}
      {(carrier || trackingNumber) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Carrier: {carrier || 'Standard Express'}
            </span>
          </div>

          {trackingNumber && (
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-500 dark:text-slate-400">Tracking:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{trackingNumber}</span>
              <IconButton
                variant="default"
                size="sm"
                aria-label={copied ? 'Copied' : 'Copy tracking number'}
                title={copied ? 'Copied' : 'Copy tracking number'}
                onClick={handleCopy}
                className="w-7 h-7 min-w-[28px] min-h-[28px]"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-600" />
                )}
              </IconButton>
            </div>
          )}
        </div>
      )}

      {/* Desktop Horizontal Stepper */}
      <div className="hidden sm:block">
        <div className="relative flex items-center justify-between">
          {/* Progress bar background line */}
          <div className="absolute top-5 left-6 right-6 h-1 bg-slate-200 dark:bg-slate-800 -z-0" />
          <div
            className="absolute top-5 left-6 h-1 bg-emerald-500 transition-all duration-500 -z-0"
            style={{ width: `${(Math.min(currentStepIdx, 4) / 4) * 85}%` }}
          />

          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            const isUpcoming = idx > currentStepIdx;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex flex-col items-center text-center z-10 w-28">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 shadow-sm ${
                    isCompleted
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950/60'
                      : isCurrent
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/60 animate-pulse'
                      : 'bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <p
                  className={`mt-2 text-xs font-semibold ${
                    isCurrent
                      ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                      : isCompleted
                      ? 'text-slate-800 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
                {step.timestamp && (
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {formatDate(step.timestamp).split(',')[0]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Vertical Timeline */}
      <div className="sm:hidden space-y-4 relative pl-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIdx;
          const isCurrent = idx === currentStepIdx;
          const Icon = step.icon;

          return (
            <div key={step.key} className="relative flex items-start gap-3">
              <div
                className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-200 animate-pulse'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}
              >
                <Icon className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    isCurrent
                      ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                      : isCompleted
                      ? 'text-slate-800 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
                {step.timestamp && (
                  <p className="text-[10px] text-slate-400 font-mono">
                    {formatDate(step.timestamp)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
