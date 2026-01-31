import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
  count?: number;
  outOfStock?: boolean;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      children,
      active = false,
      icon,
      count,
      outOfStock = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || outOfStock}
        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold select-none transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/40 border active:scale-95 whitespace-nowrap min-h-[36px] ${
          active
            ? 'bg-indigo-600 dark:bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-[#EEF2FF] dark:hover:bg-indigo-950/40 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300'
        } ${
          outOfStock
            ? 'opacity-40 line-through cursor-not-allowed hover:bg-white dark:hover:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
            : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
        {count !== undefined && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              active
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    );
  }
);

Chip.displayName = 'Chip';
