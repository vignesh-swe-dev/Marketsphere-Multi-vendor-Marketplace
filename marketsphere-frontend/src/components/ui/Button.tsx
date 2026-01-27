import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  isLoading?: boolean; // alias for backwards-compat
  shine?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
}

export type ButtonProps = BaseButtonProps &
  (
    | ({ as?: 'button' } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ as: 'a' } & React.AnchorHTMLAttributes<HTMLAnchorElement>)
  );

export const Button = React.forwardRef<HTMLButtonElement & HTMLAnchorElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      loading = false,
      isLoading = false,
      shine = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      as = 'button',
      ...props
    },
    ref
  ) => {
    const isSpinnerActive = loading || isLoading;

    const baseClasses =
      'group inline-flex items-center justify-center font-semibold rounded-xl select-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none';

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-[0_8px_20px_-6px_rgba(79,70,229,0.45)] hover:shadow-[0_12px_24px_-4px_rgba(79,70,229,0.6)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]' +
        (shine ? ' shine-button' : ''),
      secondary:
        'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-[#EEF2FF] dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 hover:-translate-y-px active:translate-y-0 active:scale-[0.97] shadow-xs',
      ghost:
        'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:bg-slate-200 dark:active:bg-slate-800 active:scale-[0.97]',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_8px_20px_-6px_rgba(244,63,94,0.45)] hover:shadow-[0_12px_24px_-4px_rgba(244,63,94,0.6)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]',
      success:
        'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.45)] hover:shadow-[0_12px_24px_-4px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]',
      link:
        'bg-transparent text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 p-0 h-auto min-h-0 link-grow-left focus-visible:ring-2 focus-visible:ring-indigo-500',
    };

    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'text-xs px-3.5 py-1.5 min-h-[36px] sm:min-h-[36px] min-h-[44px] gap-1.5',
      md: 'text-sm px-4 py-2.5 min-h-[44px] gap-2',
      lg: 'text-base px-6 py-3 min-h-[52px] gap-2.5',
    };

    const appliedClasses = `${baseClasses} ${variantClasses[variant]} ${
      variant === 'link' ? '' : sizeClasses[size]
    } ${fullWidth ? 'w-full' : ''} ${className}`;

    const content = (
      <>
        {isSpinnerActive ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span className={isSpinnerActive ? 'opacity-80' : ''}>{children}</span>
        {!isSpinnerActive && rightIcon && (
          <span className="shrink-0 transition-transform duration-200 group-hover:translate-x-1">
            {rightIcon}
          </span>
        )}
      </>
    );

    if (as === 'a') {
      const anchorProps = props as React.AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={appliedClasses}
          aria-busy={isSpinnerActive}
          {...anchorProps}
        >
          {content}
        </a>
      );
    }

    const buttonProps = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        disabled={disabled || isSpinnerActive}
        aria-busy={isSpinnerActive}
        className={appliedClasses}
        {...buttonProps}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = 'Button';
