import React from 'react';
import { Loader2 } from 'lucide-react';

export type IconButtonVariant = 'default' | 'danger' | 'filled';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string; // Required for accessibility
  variant?: IconButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'default',
      size = 'md',
      loading = false,
      disabled,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center rounded-full select-none transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:scale-105 active:scale-95 shrink-0';

    const variantClasses: Record<IconButtonVariant, string> = {
      default:
        'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700/80',
      danger:
        'bg-transparent text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 active:bg-rose-100 dark:active:bg-rose-900/60',
      filled:
        'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800/60 shadow-xs',
    };

    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-11 h-11 text-sm min-h-[44px] min-w-[44px]',
      lg: 'w-12 h-12 text-base min-h-[48px] min-w-[48px]',
    };

    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        disabled={disabled || loading}
        aria-busy={loading}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          children
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
