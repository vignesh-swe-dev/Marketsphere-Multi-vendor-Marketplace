import React, { useState } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  isValid?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  floating?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      isValid,
      leftIcon,
      rightIcon,
      clearable,
      onClear,
      floating = false,
      className = '',
      id,
      value,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = value !== undefined && value !== '' && value !== null;

    if (floating && label) {
      return (
        <div className="relative w-full">
          <div className="relative">
            {leftIcon && (
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                {leftIcon}
              </div>
            )}
            <input
              ref={ref}
              id={inputId}
              value={value}
              disabled={disabled}
              placeholder=" "
              onFocus={(e) => {
                setIsFocused(true);
                props.onFocus?.(e);
              }}
              onBlur={(e) => {
                setIsFocused(false);
                props.onBlur?.(e);
              }}
              className={`peer w-full h-12 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm transition-all duration-200 outline-none
                ${leftIcon ? 'pl-10' : 'pl-3.5'}
                ${rightIcon || clearable || isValid || error ? 'pr-10' : 'pr-3.5'}
                pt-4 pb-1
                ${
                  error
                    ? 'border-rose-500 focus:ring-3 focus:ring-rose-500/20'
                    : isValid
                    ? 'border-emerald-500 focus:ring-3 focus:ring-emerald-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/20'
                }
                disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed
                ${className}`}
              {...props}
            />
            <label
              htmlFor={inputId}
              className={`absolute cursor-text text-xs transition-all duration-200 pointer-events-none
                ${leftIcon ? 'left-10' : 'left-3.5'}
                ${
                  isFocused || hasValue
                    ? 'top-2 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400'
                    : 'top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500'
                }
                ${error ? 'text-rose-500 dark:text-rose-400' : ''}
              `}
            >
              {label}
            </label>

            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
              {clearable && hasValue && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onClear}
                  className="p-1 hover:text-slate-600 dark:hover:text-slate-300 rounded-md"
                  aria-label="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {error && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
              {isValid && !error && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
              {rightIcon}
            </div>
          </div>

          {(error || helperText) && (
            <p
              className={`mt-1.5 text-xs flex items-center gap-1 ${
                error ? 'text-rose-500 font-medium' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {error || helperText}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            value={value}
            disabled={disabled}
            className={`w-full min-h-[44px] rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm transition-all duration-200 outline-none
              ${leftIcon ? 'pl-10' : 'pl-3.5'}
              ${rightIcon || clearable || isValid || error ? 'pr-10' : 'pr-3.5'}
              py-2.5
              ${
                error
                  ? 'border-rose-500 focus:ring-3 focus:ring-rose-500/20'
                  : isValid
                  ? 'border-emerald-500 focus:ring-3 focus:ring-emerald-500/20'
                  : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/20'
              }
              disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed
              ${className}`}
            {...props}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
            {clearable && hasValue && (
              <button
                type="button"
                tabIndex={-1}
                onClick={onClear}
                className="p-1 hover:text-slate-600 dark:hover:text-slate-300 rounded-md"
                aria-label="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {error && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
            {isValid && !error && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
            {rightIcon}
          </div>
        </div>
        {(error || helperText) && (
          <p
            className={`text-xs flex items-center gap-1 ${
              error ? 'text-rose-500 font-medium' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
