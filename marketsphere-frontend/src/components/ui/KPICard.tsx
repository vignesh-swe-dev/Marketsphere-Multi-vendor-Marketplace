import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatMoney, formatMoneyCompact } from '../../lib/formatters.ts';

export interface KPICardProps {
  title: string;
  value: number; // In cents/paise if isCurrency is true, or integer count
  isCurrency?: boolean;
  useCompact?: boolean;
  trend?: string;
  trendPositive?: boolean;
  icon?: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  isCurrency = false,
  useCompact = false,
  trend,
  trendPositive = true,
  icon,
  subtitle,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 800; // ms
    const startValue = 0;
    const targetValue = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(startValue + (targetValue - startValue) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
          {isCurrency
            ? (useCompact ? formatMoneyCompact(displayValue) : formatMoney(displayValue))
            : displayValue.toLocaleString()}
        </div>

        {trend && (
          <div
            className={`flex items-center gap-1 text-[11px] font-bold font-mono px-2 py-0.5 rounded-full ${
              trendPositive
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
            }`}
          >
            {trendPositive ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            <span>{trend}</span>
          </div>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</p>
      )}
    </div>
  );
};
