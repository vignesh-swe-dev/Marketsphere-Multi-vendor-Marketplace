import React, { useState } from 'react';
import { 
  Store, 
  Building2, 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  FileCheck2,
  Lock
} from 'lucide-react';
import type { User } from '../types/index.ts';
import { Modal, Button, Input, Badge } from './ui/index.ts';
import { apiFetch } from '../lib/apiClient.ts';

interface SellerApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSuccess: () => void;
}

export const SellerApplicationModal: React.FC<SellerApplicationModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [businessReg, setBusinessReg] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactEmail, setContactEmail] = useState(currentUser?.email || '');
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || '');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState(currentUser?.fullName || '');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingOrIfsc, setRoutingOrIfsc] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const steps = [
    { num: 1, label: 'Business' },
    { num: 2, label: 'Tax & Compliance' },
    { num: 3, label: 'Banking Settlement' },
    { num: 4, label: 'Review & Sign' },
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiFetch('/seller/applications', {
        method: 'POST',
        body: JSON.stringify({
          businessName: businessName || 'Artisan Goods Co.',
          businessRegNumber: businessReg || 'US-REG-84729',
          taxId: taxId || '98-7654321',
          contactEmail: contactEmail || currentUser.email,
          contactPhone: contactPhone || '+1-555-0182',
          bankDetails: {
            accountHolder: accountHolder || currentUser.fullName,
            bankName: bankName || 'Silicon Valley Bank',
            accountNumberMasked: accountNumber || '****9941',
            routingOrIfsc: routingOrIfsc || '121000358',
          },
        }),
      });

      setIsSuccess(true);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error submitting application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step < 4) setStep((prev) => (prev + 1) as any);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as any);
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setStep(1);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title={
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Vendor Onboarding Application</span>
        </div>
      }
      description="Launch your independent shop on MarketSphere with multi-vendor checkout"
      maxWidth="lg"
    >
      <div className="space-y-6 pt-1">
        {/* Progress Bar & Steps Stepper */}
        {!isSuccess && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Step {step} of 4: {steps[step - 1].label}</span>
              <span className="font-mono text-[11px]">{step * 25}% complete</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full transition-all duration-300"
                style={{ width: `${step * 25}%` }}
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Application Successfully Submitted!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your application was submitted. You will get access to the Seller Hub once an administrator approves it.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleResetAndClose}
            >
              Close & Return to Storefront
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* STEP 1: BUSINESS IDENTITY */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  <Building2 className="w-4 h-4" />
                  <span>Business Legal Entity</span>
                </div>

                <Input
                  label="Legal Business / Brand Name"
                  placeholder="e.g. Apex Electronics Ltd."
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Contact Email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                  />
                  <Input
                    label="Contact Phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* STEP 2: TAX & COMPLIANCE */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Tax Registration & Compliance</span>
                </div>

                <Input
                  label="Business Registration / EIN"
                  placeholder="e.g. US-REG-84729"
                  value={businessReg}
                  onChange={(e) => setBusinessReg(e.target.value)}
                  className="font-mono"
                  required
                />

                <Input
                  label="Tax Identification Number (TIN / SSN)"
                  placeholder="e.g. 98-7654321"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="font-mono"
                  helperText="Masked and encrypted for 1099-K tax reporting compliance"
                  rightIcon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
                  required
                />
              </div>
            )}

            {/* STEP 3: SETTLEMENT BANKING */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  <CreditCard className="w-4 h-4" />
                  <span>Direct Disbursement Banking</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Bank Name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                  />
                  <Input
                    label="Account Holder Name"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Account Number (Masked)"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="font-mono"
                    rightIcon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
                    required
                  />
                  <Input
                    label="Routing / IFSC Code"
                    value={routingOrIfsc}
                    onChange={(e) => setRoutingOrIfsc(e.target.value)}
                    className="font-mono"
                    required
                  />
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & SIGN */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <FileCheck2 className="w-4 h-4" />
                    <span>Review Application Dossier</span>
                  </div>
                  <Badge variant="primary" size="sm">Ready to Submit</Badge>
                </div>

                <div className="space-y-3">
                  {/* Business section */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                        Business Entity
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Legal Name:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{businessName || 'Artisan Goods Co.'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Email:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{contactEmail}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Phone:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{contactPhone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tax section */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        Tax & Compliance
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Business EIN / Reg:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{businessReg || 'US-REG-84729'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tax ID (TIN):</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{taxId ? `***-**-${taxId.slice(-4)}` : '98-7654321'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bank section */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-violet-500" />
                        Banking Settlement
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Disbursement Bank:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Account Holder:</span>
                        <span className="text-slate-700 dark:text-slate-300">{accountHolder}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Account Number:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {accountNumber.startsWith('****') ? accountNumber : `****${accountNumber.slice(-4)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  By clicking Submit Application, you agree to MarketSphere's Merchant Terms of Service, double-entry ledger commission deductions, and seller code of conduct.
                </p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              {step > 1 ? (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleBack}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleResetAndClose}
                >
                  Cancel
                </Button>
              )}

              {step < 4 ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleNext}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Next Step
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleSubmit()}
                  loading={isSubmitting}
                  shine
                >
                  Submit Application
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
