import React from 'react';
import { formatMoney } from '../../lib/formatters.ts';
import { CURRENCY } from '../../lib/currency.ts';

export interface PriceTagProps {
  priceCents?: number;
  cents?: number;
  compareAtCents?: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PriceTag: React.FC<PriceTagProps> = ({
  priceCents,
  cents,
  compareAtCents,
  currency = CURRENCY,
  size = 'md',
  className = '',
}) => {
  const actualPrice = priceCents ?? cents ?? 0;
  const hasDiscount = compareAtCents !== undefined && compareAtCents > actualPrice;
  const discountPercent = hasDiscount
    ? Math.round(((compareAtCents - actualPrice) / compareAtCents) * 100)
    : 0;

  const sizeClasses = {
    sm: 'text-sm font-bold',
    md: 'text-base font-bold',
    lg: 'text-xl font-extrabold',
    xl: 'text-2xl sm:text-3xl font-extrabold',
  };

  const compareClasses = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
    xl: 'text-base',
  };

  return (
    <div className={`inline-flex items-baseline flex-wrap gap-2 ${className}`}>
      <span className={`text-slate-900 dark:text-slate-100 tracking-tight font-mono ${sizeClasses[size]}`}>
        {formatMoney(actualPrice, currency)}
      </span>

      {hasDiscount && (
        <span
          className={`text-slate-400 line-through font-mono font-medium ${compareClasses[size]}`}
        >
          {formatMoney(compareAtCents, currency)}
        </span>
      )}

      {hasDiscount && (
        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 px-1.5 py-0.5 rounded-full font-mono">
          -{discountPercent}%
        </span>
      )}
    </div>
  );
};
