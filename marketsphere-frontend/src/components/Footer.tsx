import React, { useState } from 'react';
import { 
  Layers, 
  Send, 
  ShieldCheck, 
  CreditCard, 
  Truck, 
  RotateCcw,
  CheckCircle2,
  Twitter,
  Instagram,
  Github,
  Linkedin
} from 'lucide-react';
import { Button } from './ui/Button.tsx';
import { Logo } from './Logo.tsx';

export interface FooterProps {
  onOpenSellerApply?: () => void;
  onSelectCategory?: (id: string | null) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenSellerApply, onSelectCategory }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubscribed(true);
    setTimeout(() => {
      setSubscribed(false);
      setEmail('');
    }, 4000);
  };

  return (
    <footer className="bg-[#0B1220] text-slate-400 text-xs border-t border-slate-800/80">
      {/* Trust Badges Bar */}
      <div className="border-b border-slate-800/60 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Multi-Vendor Dispatch</h4>
                <p className="text-[11px] text-slate-400">Independent shop fulfillment</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Escrow Protected</h4>
                <p className="text-[11px] text-slate-400">Append-only ledger guarantee</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/20">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">30-Day Returns</h4>
                <p className="text-[11px] text-slate-400">Live dispute resolution</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Unified Checkout</h4>
                <p className="text-[11px] text-slate-400">Single payment across sellers</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Links & Newsletter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <Logo size="md" showWordmark={true} />
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              The premier open multi-vendor e-commerce platform. Connect with independent creators, verified manufacturers, and specialty merchants worldwide.
            </p>

            {/* Newsletter Input */}
            <form onSubmit={handleSubscribe} className="space-y-2 max-w-sm">
              <p className="text-xs font-semibold text-slate-300">Join our merchant & buyer dispatch</p>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Enter your email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                  required
                />
                <Button variant="primary" size="sm" type="submit">
                  Subscribe
                </Button>
              </div>
              {subscribed && (
                <p className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Subscribed to platform releases & updates!
                </p>
              )}
            </form>
          </div>

          {/* Column 1: Shop */}
          <div className="space-y-3">
            <h5 className="font-bold text-white text-xs uppercase tracking-wider">Shop</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.(null)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  All Products
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.('cat-electronics')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Electronics & Tech
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.('cat-home')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Home & Living
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.('cat-apparel')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Apparel & Goods
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Sell on MarketSphere */}
          <div className="space-y-3">
            <h5 className="font-bold text-white text-xs uppercase tracking-wider">Sell on MarketSphere</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={onOpenSellerApply}
                  className="hover:text-white transition-colors cursor-pointer text-indigo-400 font-semibold"
                >
                  Become a Seller
                </button>
              </li>
              <li>
                <a href="#seller-hub" className="hover:text-white transition-colors">
                  Seller Dashboard
                </a>
              </li>
              <li>
                <a href="#fee-tiers" className="hover:text-white transition-colors">
                  Commission Rules
                </a>
              </li>
              <li>
                <a href="#kyb" className="hover:text-white transition-colors">
                  Merchant Verification
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Support */}
          <div className="space-y-3">
            <h5 className="font-bold text-white text-xs uppercase tracking-wider">Support</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#help-center" className="hover:text-white transition-colors">
                  Help Center & FAQ
                </a>
              </li>
              <li>
                <a href="#order-tracking" className="hover:text-white transition-colors">
                  Track an Order
                </a>
              </li>
              <li>
                <a href="#refund-policy" className="hover:text-white transition-colors">
                  Returns & Refunds
                </a>
              </li>
              <li>
                <a href="#buyer-protection" className="hover:text-white transition-colors">
                  Buyer Protection
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Company */}
          <div className="space-y-3">
            <h5 className="font-bold text-white text-xs uppercase tracking-wider">Company</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  About MarketSphere
                </a>
              </li>
              <li>
                <a href="#ledger" className="hover:text-white transition-colors">
                  Double-Entry Ledger
                </a>
              </li>
              <li>
                <a href="#privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#terms" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* Bottom Bar: Copyright & Socials */}
      <div className="border-t border-slate-800/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} MarketSphere Inc. Multi-Vendor Platform Architecture. All rights reserved.
          </p>

          <div className="flex items-center gap-4 text-slate-400">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              className="p-1 hover:text-indigo-400 hover:scale-115 transition-all duration-200"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="p-1 hover:text-rose-400 hover:scale-115 transition-all duration-200"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="p-1 hover:text-white hover:scale-115 transition-all duration-200"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="p-1 hover:text-indigo-400 hover:scale-115 transition-all duration-200"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
