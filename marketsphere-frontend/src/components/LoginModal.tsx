import React, { useState, useEffect, useRef } from 'react';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  User as UserIcon, 
  Phone, 
  AlertCircle, 
  X, 
  Loader2, 
  ShieldCheck,
  Store 
} from 'lucide-react';
import type { User } from '../types/index.ts';
import { Modal } from './ui/Modal.tsx';
import { Logo } from './Logo.tsx';
import { login, register, ApiError } from '../lib/apiClient.ts';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: User) => void;
}

interface ServerErrorState {
  code?: string;
  message: string;
  showSwitchToSignIn?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');

  // Form Fields
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  const [registerFullName, setRegisterFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<'CUSTOMER' | 'SELLER'>('CUSTOMER');
  const [registerBusinessName, setRegisterBusinessName] = useState('');

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<ServerErrorState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  // Input & Focus Refs
  const signinEmailRef = useRef<HTMLInputElement>(null);
  const signinPasswordRef = useRef<HTMLInputElement>(null);
  const registerNameRef = useRef<HTMLInputElement>(null);
  const registerEmailRef = useRef<HTMLInputElement>(null);
  const registerPhoneRef = useRef<HTMLInputElement>(null);
  const registerPasswordRef = useRef<HTMLInputElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const tabSigninRef = useRef<HTMLButtonElement>(null);
  const tabRegisterRef = useRef<HTMLButtonElement>(null);

  // Reset all state
  const resetFormState = () => {
    setSigninEmail('');
    setSigninPassword('');
    setRegisterFullName('');
    setRegisterEmail('');
    setRegisterPhone('');
    setRegisterPassword('');
    setRegisterRole('CUSTOMER');
    setRegisterBusinessName('');
    setShowPassword(false);
    setIsLoading(false);
    setServerError(null);
    setFieldErrors({});
    setTouchedFields({});
  };

  const handleClose = () => {
    resetFormState();
    onClose();
  };

  // Track opener element and restore focus on close
  useEffect(() => {
    if (isOpen) {
      lastActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Autofocus first input on open
      const timer = setTimeout(() => {
        if (mode === 'signin') {
          signinEmailRef.current?.focus();
        } else {
          registerNameRef.current?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      resetFormState();
      if (lastActiveElementRef.current && typeof lastActiveElementRef.current.focus === 'function') {
        lastActiveElementRef.current.focus();
      }
    }
  }, [isOpen]);

  // Autofocus first input when switching mode
  useEffect(() => {
    if (!isOpen) return;
    setServerError(null);
    setFieldErrors({});
    setTouchedFields({});
    setShowPassword(false);

    const timer = setTimeout(() => {
      if (mode === 'signin') {
        signinEmailRef.current?.focus();
      } else {
        registerNameRef.current?.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [mode]);

  // Trap focus inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key !== 'Tab' || !modalContainerRef.current) return;

      const focusableElements = modalContainerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Validation functions
  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const isValidIndianPhone = (val: string) => {
    if (!val.trim()) return true; // Optional field
    const cleaned = val.trim().replace(/[\s\-()]/g, '');
    // Standard 10 digits starting with 6-9
    if (/^[6-9]\d{9}$/.test(cleaned)) return true;
    // With +91
    if (/^\+91[6-9]\d{9}$/.test(cleaned)) return true;
    // With 91
    if (/^91[6-9]\d{9}$/.test(cleaned)) return true;
    // With leading 0
    if (/^0[6-9]\d{9}$/.test(cleaned)) return true;
    return false;
  };

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'signinEmail':
        if (!value.trim()) return 'Email is required.';
        if (!isValidEmail(value)) return 'Please enter a valid email address.';
        return '';
      case 'signinPassword':
        if (!value) return 'Password is required.';
        return '';
      case 'registerFullName':
        if (!value.trim()) return 'Full name is required.';
        if (value.trim().length < 2) return 'Full name must be at least 2 characters.';
        if (value.trim().length > 100) return 'Full name must be under 100 characters.';
        return '';
      case 'registerEmail':
        if (!value.trim()) return 'Email is required.';
        if (!isValidEmail(value)) return 'Please enter a valid email address.';
        return '';
      case 'registerPhone':
        if (value.trim() && !isValidIndianPhone(value)) {
          return 'Enter a valid 10-digit Indian mobile number.';
        }
        return '';
      case 'registerPassword':
        if (!value) return 'Password is required.';
        if (value.length < 8 || value.length > 72) {
          return 'Password must be between 8 and 72 characters.';
        }
        if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
          return 'Password must contain at least one letter and one number.';
        }
        return '';
      default:
        return '';
    }
  };

  const handleBlur = (field: string, value: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const mapServerError = (err: unknown): ServerErrorState => {
    if (err instanceof ApiError) {
      if (err.code === 'INVALID_CREDENTIALS') {
        return {
          code: err.code,
          message: 'Email or password is incorrect.',
        };
      }
      if (err.code === 'RATE_LIMITED' || err.status === 429) {
        return {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Try again in 15 minutes.',
        };
      }
      if (err.code === 'EMAIL_EXISTS') {
        return {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists.',
          showSwitchToSignIn: true,
        };
      }
      if (err.message && err.message !== 'API_ERROR') {
        return {
          code: err.code,
          message: err.message,
        };
      }
    } else if (err instanceof Error && err.message) {
      if (err.message.includes('fetch') || err.message.includes('Network') || err.message.includes('Failed to fetch')) {
        return {
          message: 'Could not reach the server. Check your connection.',
        };
      }
      return {
        message: err.message,
      };
    }

    return {
      message: 'Could not reach the server. Check your connection.',
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setServerError(null);

    // Validate all fields for current mode
    const errors: Record<string, string> = {};
    const touched: Record<string, boolean> = {};

    if (mode === 'signin') {
      touched.signinEmail = true;
      touched.signinPassword = true;

      const emailErr = validateField('signinEmail', signinEmail);
      if (emailErr) errors.signinEmail = emailErr;

      const pwdErr = validateField('signinPassword', signinPassword);
      if (pwdErr) errors.signinPassword = pwdErr;

      setTouchedFields((prev) => ({ ...prev, ...touched }));
      setFieldErrors(errors);

      if (Object.keys(errors).length > 0) {
        if (errors.signinEmail) {
          signinEmailRef.current?.focus();
        } else if (errors.signinPassword) {
          signinPasswordRef.current?.focus();
        }
        return;
      }
    } else {
      touched.registerFullName = true;
      touched.registerEmail = true;
      touched.registerPhone = true;
      touched.registerPassword = true;

      const nameErr = validateField('registerFullName', registerFullName);
      if (nameErr) errors.registerFullName = nameErr;

      const emailErr = validateField('registerEmail', registerEmail);
      if (emailErr) errors.registerEmail = emailErr;

      const phoneErr = validateField('registerPhone', registerPhone);
      if (phoneErr) errors.registerPhone = phoneErr;

      const pwdErr = validateField('registerPassword', registerPassword);
      if (pwdErr) errors.registerPassword = pwdErr;

      setTouchedFields((prev) => ({ ...prev, ...touched }));
      setFieldErrors(errors);

      if (Object.keys(errors).length > 0) {
        if (errors.registerFullName) {
          registerNameRef.current?.focus();
        } else if (errors.registerEmail) {
          registerEmailRef.current?.focus();
        } else if (errors.registerPhone) {
          registerPhoneRef.current?.focus();
        } else if (errors.registerPassword) {
          registerPasswordRef.current?.focus();
        }
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const result = await login(signinEmail.trim().toLowerCase(), signinPassword);
        onLoginSuccess?.(result.user);
        handleClose();
      } else {
        const result = await register({
          fullName: registerFullName.trim(),
          email: registerEmail.trim().toLowerCase(),
          password: registerPassword,
          phone: registerPhone.trim() || undefined,
          role: registerRole,
          businessName: registerRole === 'SELLER' ? registerBusinessName.trim() || undefined : undefined,
        });
        onLoginSuccess?.(result.user);
        handleClose();
      }
    } catch (err: unknown) {
      setServerError(mapServerError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // "Sign in instead" handler when EMAIL_EXISTS is returned
  const handleSwitchToSignInFromExisting = () => {
    const retainedEmail = registerEmail;
    setMode('signin');
    setSigninEmail(retainedEmail);
    setSigninPassword('');
    setServerError(null);
    setFieldErrors({});
    setTouchedFields({});
    setTimeout(() => {
      signinPasswordRef.current?.focus();
    }, 50);
  };

  // Keyboard navigation for tablist
  const handleTablistKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (mode === 'signin') {
        setMode('register');
        tabRegisterRef.current?.focus();
      } else {
        setMode('signin');
        tabSigninRef.current?.focus();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setMode('signin');
      tabSigninRef.current?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setMode('register');
      tabRegisterRef.current?.focus();
    }
  };


  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="3xl"
      showCloseButton={false}
    >
      <div
        ref={modalContainerRef}
        className="font-sans grid grid-cols-1 md:grid-cols-2 -m-6 overflow-hidden min-h-[580px] text-slate-900 dark:text-slate-100"
      >
        {/* Left Brand Panel (Desktop only: md+) */}
        <div className="dark hidden md:flex flex-col justify-between p-8 bg-slate-900 text-white relative border-r border-slate-800 select-none">
          <div className="space-y-6">
            <div className="flex items-center">
              <Logo size="md" showWordmark={true} />
            </div>

            <div className="space-y-3 pt-2">
              <h2 className="font-display text-[28px] leading-[36px] font-bold tracking-[-0.02em] text-white text-left">
                Buy from verified sellers. See GST on every order.
              </h2>
              <p className="font-sans text-[13px] leading-[18px] text-slate-300 max-w-[65ch] text-left">
                Direct transactions with GST-registered Indian merchants, transparent invoices, and verified trust.
              </p>
            </div>

            <div className="pt-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3.5 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-white">GSTIN-Verified Merchants</h3>
                    <p className="text-[12px] text-slate-400 leading-relaxed">Direct trade with verified sellers across India.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 pt-3 border-t border-slate-800/80">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-white">Escrow Protection</h3>
                    <p className="text-[12px] text-slate-400 leading-relaxed">Payments held securely in escrow until order delivery.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/80 flex items-center gap-2.5 text-[13px] leading-[18px] text-slate-400 text-left">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="max-w-[65ch]">Sellers are checked with GSTIN and PAN before they can list.</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-6 sm:p-8 flex flex-col justify-between bg-white dark:bg-slate-900 overflow-y-auto font-sans">
          <div className="space-y-5">
            {/* Top row: mobile logo & accessible close button */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 text-left">
                <div className="md:hidden pb-1">
                  <Logo size="sm" showWordmark={true} />
                </div>
                <h1
                  id="auth-heading"
                  className="font-display text-[24px] leading-[32px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white"
                >
                  {mode === 'signin' ? 'Sign in to MarketSphere' : 'Create an account'}
                </h1>
                <p className="font-sans text-[13px] leading-[18px] text-slate-600 dark:text-slate-400 max-w-[65ch]">
                  {mode === 'signin'
                    ? 'Access your orders, saved addresses, and seller dashboard.'
                    : 'Start shopping with transparent GST invoices from verified Indian sellers.'}
                </p>
              </div>

              {/* Close button placed inside form panel */}
              <button
                type="button"
                onClick={handleClose}
                className="p-2 -mr-2 -mt-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Segmented Control / Tablist */}
            <div
              role="tablist"
              aria-label="Account access tabs"
              onKeyDown={handleTablistKeyDown}
              className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl select-none"
            >
              <button
                ref={tabSigninRef}
                type="button"
                role="tab"
                id="tab-signin"
                aria-selected={mode === 'signin'}
                aria-controls="panel-signin"
                tabIndex={mode === 'signin' ? 0 : -1}
                onClick={() => setMode('signin')}
                className={`flex-1 min-h-[44px] py-2 px-3 text-[16px] sm:text-[15px] font-medium rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  mode === 'signin'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                ref={tabRegisterRef}
                type="button"
                role="tab"
                id="tab-register"
                aria-selected={mode === 'register'}
                aria-controls="panel-register"
                tabIndex={mode === 'register' ? 0 : -1}
                onClick={() => setMode('register')}
                className={`flex-1 min-h-[44px] py-2 px-3 text-[16px] sm:text-[15px] font-medium rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Server Error Banner */}
            {serverError && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-[13px] leading-[18px] text-rose-800 dark:text-rose-200 flex items-start gap-2.5 text-left"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium leading-relaxed max-w-[65ch]">{serverError.message}</p>
                  {serverError.showSwitchToSignIn && (
                    <button
                      type="button"
                      onClick={handleSwitchToSignInFromExisting}
                      className="inline-flex items-center min-h-[44px] text-[13px] font-semibold text-indigo-700 dark:text-indigo-400 underline underline-offset-4 hover:text-indigo-900 dark:hover:text-indigo-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                    >
                      Sign in instead
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Form */}
            <form
              id={mode === 'signin' ? 'panel-signin' : 'panel-register'}
              role="tabpanel"
              aria-labelledby={mode === 'signin' ? 'tab-signin' : 'tab-register'}
              onSubmit={handleSubmit}
              noValidate
              className="space-y-4 text-left"
            >
              {mode === 'register' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-sans text-[14px] leading-[20px] font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Account Type <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account Role">
                      <button
                        type="button"
                        id="role-select-customer"
                        role="radio"
                        aria-checked={registerRole === 'CUSTOMER'}
                        onClick={() => setRegisterRole('CUSTOMER')}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer outline-none ${
                          registerRole === 'CUSTOMER'
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-600/30'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${
                              registerRole === 'CUSTOMER' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              <UserIcon className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-sm">Customer</span>
                          </div>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            registerRole === 'CUSTOMER'
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {registerRole === 'CUSTOMER' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          Browse & purchase authentic goods
                        </p>
                      </button>

                      <button
                        type="button"
                        id="role-select-seller"
                        role="radio"
                        aria-checked={registerRole === 'SELLER'}
                        onClick={() => setRegisterRole('SELLER')}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer outline-none ${
                          registerRole === 'SELLER'
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-600/30'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${
                              registerRole === 'SELLER' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              <Store className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-sm">Seller</span>
                          </div>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            registerRole === 'SELLER'
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {registerRole === 'SELLER' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          Sell products & manage storefront
                        </p>
                      </button>
                    </div>
                  </div>

                  {registerRole === 'SELLER' && (
                    <div className="pt-0.5">
                      <label
                        htmlFor="register-business-name"
                        className="block font-sans text-[13px] leading-[18px] font-medium text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Store / Business Name <span className="text-slate-400 text-xs">(Optional)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Store className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <input
                          id="register-business-name"
                          type="text"
                          disabled={isLoading}
                          value={registerBusinessName}
                          onChange={(e) => setRegisterBusinessName(e.target.value)}
                          placeholder="e.g. Kaveri Silks & Heritage"
                          className="w-full min-h-[42px] h-10 pl-10 pr-3.5 rounded-xl border text-[14px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-600/20 dark:focus:ring-indigo-400/20 outline-none"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        An active merchant store will automatically be created for your account.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="register-fullname"
                    className="block font-sans text-[14px] leading-[20px] font-medium text-slate-700 dark:text-slate-300 normal-case tracking-normal mb-1.5"
                  >
                    Full name
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <UserIcon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <input
                      ref={registerNameRef}
                      id="register-fullname"
                      type="text"
                      autoComplete="name"
                      disabled={isLoading}
                      value={registerFullName}
                      onChange={(e) => {
                        setRegisterFullName(e.target.value);
                        if (fieldErrors.registerFullName) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.registerFullName;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('registerFullName', registerFullName)}
                      aria-invalid={touchedFields.registerFullName && !!fieldErrors.registerFullName}
                      aria-describedby={
                        touchedFields.registerFullName && fieldErrors.registerFullName
                          ? 'register-fullname-error'
                          : undefined
                      }
                      placeholder="e.g. Priya Sharma"
                      className={`w-full min-h-[44px] h-11 pl-11 pr-3.5 rounded-xl border text-[16px] sm:text-[15px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors outline-none ${
                        touchedFields.registerFullName && fieldErrors.registerFullName
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-slate-300 dark:border-slate-700 focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-600/20 dark:focus:ring-indigo-400/20'
                      } disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed`}
                    />
                  </div>
                  {touchedFields.registerFullName && fieldErrors.registerFullName && (
                    <p
                      id="register-fullname-error"
                      role="alert"
                      className="mt-1.5 font-sans text-[13px] leading-[18px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.registerFullName}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Email Address Field */}
              <div>
                <label
                  htmlFor={mode === 'signin' ? 'signin-email' : 'register-email'}
                  className="block font-sans text-[14px] leading-[20px] font-medium text-slate-700 dark:text-slate-300 normal-case tracking-normal mb-1.5"
                >
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Mail className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <input
                    ref={mode === 'signin' ? signinEmailRef : registerEmailRef}
                    id={mode === 'signin' ? 'signin-email' : 'register-email'}
                    type="email"
                    autoComplete={mode === 'signin' ? 'username email' : 'email'}
                    disabled={isLoading}
                    value={mode === 'signin' ? signinEmail : registerEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (mode === 'signin') {
                        setSigninEmail(val);
                        if (fieldErrors.signinEmail) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.signinEmail;
                            return next;
                          });
                        }
                      } else {
                        setRegisterEmail(val);
                        if (fieldErrors.registerEmail) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.registerEmail;
                            return next;
                          });
                        }
                      }
                    }}
                    onBlur={() => {
                      if (mode === 'signin') {
                        handleBlur('signinEmail', signinEmail);
                      } else {
                        handleBlur('registerEmail', registerEmail);
                      }
                    }}
                    aria-invalid={
                      mode === 'signin'
                        ? touchedFields.signinEmail && !!fieldErrors.signinEmail
                        : touchedFields.registerEmail && !!fieldErrors.registerEmail
                    }
                    aria-describedby={
                      mode === 'signin'
                        ? touchedFields.signinEmail && fieldErrors.signinEmail
                          ? 'signin-email-error'
                          : undefined
                        : touchedFields.registerEmail && fieldErrors.registerEmail
                        ? 'register-email-error'
                        : undefined
                    }
                    placeholder="name@example.com"
                    className={`w-full min-h-[44px] h-11 pl-11 pr-3.5 rounded-xl border text-[16px] sm:text-[15px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors outline-none ${
                      (mode === 'signin' && touchedFields.signinEmail && fieldErrors.signinEmail) ||
                      (mode === 'register' && touchedFields.registerEmail && fieldErrors.registerEmail)
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 dark:border-slate-700 focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-600/20 dark:focus:ring-indigo-400/20'
                    } disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed`}
                  />
                </div>
                {((mode === 'signin' && touchedFields.signinEmail && fieldErrors.signinEmail) ||
                  (mode === 'register' && touchedFields.registerEmail && fieldErrors.registerEmail)) && (
                  <p
                    id={mode === 'signin' ? 'signin-email-error' : 'register-email-error'}
                    role="alert"
                    className="mt-1.5 font-sans text-[13px] leading-[18px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{mode === 'signin' ? fieldErrors.signinEmail : fieldErrors.registerEmail}</span>
                  </p>
                )}
              </div>

              {/* Mobile Phone Number (Register only, optional, Indian format) */}
              {mode === 'register' && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label
                      htmlFor="register-phone"
                      className="font-sans text-[14px] leading-[20px] font-medium text-slate-700 dark:text-slate-300 normal-case tracking-normal"
                    >
                      Mobile number
                    </label>
                    <span className="font-sans text-[12px] leading-[16px] text-slate-500 dark:text-slate-400">
                      Optional
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Phone className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <input
                      ref={registerPhoneRef}
                      id="register-phone"
                      type="tel"
                      autoComplete="tel"
                      disabled={isLoading}
                      value={registerPhone}
                      onChange={(e) => {
                        setRegisterPhone(e.target.value);
                        if (fieldErrors.registerPhone) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.registerPhone;
                            return next;
                          });
                        }
                      }}
                      onBlur={() => handleBlur('registerPhone', registerPhone)}
                      aria-invalid={touchedFields.registerPhone && !!fieldErrors.registerPhone}
                      aria-describedby={
                        touchedFields.registerPhone && fieldErrors.registerPhone
                          ? 'register-phone-error'
                          : undefined
                      }
                      placeholder="+91 98765 43210"
                      className={`w-full min-h-[44px] h-11 pl-11 pr-3.5 rounded-xl border text-[16px] sm:text-[15px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors outline-none ${
                        touchedFields.registerPhone && fieldErrors.registerPhone
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-slate-300 dark:border-slate-700 focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-600/20 dark:focus:ring-indigo-400/20'
                      } disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed`}
                    />
                  </div>
                  {touchedFields.registerPhone && fieldErrors.registerPhone && (
                    <p
                      id="register-phone-error"
                      role="alert"
                      className="mt-1.5 font-sans text-[13px] leading-[18px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.registerPhone}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Password Field */}
              <div>
                <label
                  htmlFor={mode === 'signin' ? 'signin-password' : 'register-password'}
                  className="block font-sans text-[14px] leading-[20px] font-medium text-slate-700 dark:text-slate-300 normal-case tracking-normal mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <input
                    ref={mode === 'signin' ? signinPasswordRef : registerPasswordRef}
                    id={mode === 'signin' ? 'signin-password' : 'register-password'}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    disabled={isLoading}
                    value={mode === 'signin' ? signinPassword : registerPassword}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (mode === 'signin') {
                        setSigninPassword(val);
                        if (fieldErrors.signinPassword) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.signinPassword;
                            return next;
                          });
                        }
                      } else {
                        setRegisterPassword(val);
                        if (fieldErrors.registerPassword) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.registerPassword;
                            return next;
                          });
                        }
                      }
                    }}
                    onBlur={() => {
                      if (mode === 'signin') {
                        handleBlur('signinPassword', signinPassword);
                      } else {
                        handleBlur('registerPassword', registerPassword);
                      }
                    }}
                    aria-invalid={
                      mode === 'signin'
                        ? touchedFields.signinPassword && !!fieldErrors.signinPassword
                        : touchedFields.registerPassword && !!fieldErrors.registerPassword
                    }
                    aria-describedby={
                      mode === 'signin'
                        ? touchedFields.signinPassword && fieldErrors.signinPassword
                          ? 'signin-password-error'
                          : undefined
                        : touchedFields.registerPassword && fieldErrors.registerPassword
                        ? 'register-password-error'
                        : undefined
                    }
                    placeholder="••••••••"
                    className={`w-full min-h-[44px] h-11 pl-11 pr-12 rounded-xl border text-[16px] sm:text-[15px] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors outline-none ${
                      (mode === 'signin' && touchedFields.signinPassword && fieldErrors.signinPassword) ||
                      (mode === 'register' && touchedFields.registerPassword && fieldErrors.registerPassword)
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 dark:border-slate-700 focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-600/20 dark:focus:ring-indigo-400/20'
                    } disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Eye className="w-5 h-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {((mode === 'signin' && touchedFields.signinPassword && fieldErrors.signinPassword) ||
                  (mode === 'register' && touchedFields.registerPassword && fieldErrors.registerPassword)) && (
                  <p
                    id={mode === 'signin' ? 'signin-password-error' : 'register-password-error'}
                    role="alert"
                    className="mt-1.5 font-sans text-[13px] leading-[18px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{mode === 'signin' ? fieldErrors.signinPassword : fieldErrors.registerPassword}</span>
                  </p>
                )}

              </div>

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[44px] h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[16px] sm:text-[15px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {isLoading && (
                  <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                )}
                <span>
                  {isLoading
                    ? mode === 'signin'
                      ? 'Signing in...'
                      : 'Creating account...'
                    : mode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
                </span>
              </button>
            </form>
          </div>

        </div>
      </div>
    </Modal>
  );
};
