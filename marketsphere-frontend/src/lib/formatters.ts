/**
 * Indian Rupee & IST DateTime Formatting Engine
 * Centralized formatting using en-IN locale and Asia/Kolkata timezone.
 * All monetary amounts in minor units: for INR that is paise (100 paise = ₹1).
 */

import { CURRENCY, LOCALE, CURRENCY_SYMBOL } from './currency.ts';

/**
 * Formats a monetary amount in minor units (paise / 100 = ₹1) into localized Indian Rupees.
 * Uses en-IN locale for Indian numbering system (e.g. ₹1,23,456.00).
 */
export function formatMoney(paise: number, currency: string = CURRENCY): string {
  if (paise === null || paise === undefined || isNaN(paise)) {
    paise = 0;
  }

  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/**
 * Optional compact monetary formatter for large numbers on KPI cards and charts.
 * Supports Thousand (K), Lakh (L), and Crore (Cr).
 * Examples: ₹12.4K, ₹3.2L, ₹1.5Cr
 */
export function formatMoneyCompact(paise: number): string {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return `${CURRENCY_SYMBOL}0`;
  }

  const roundedUnits = Math.round(paise);
  const isNegative = roundedUnits < 0;
  const absUnits = Math.abs(roundedUnits);
  const amount = absUnits / 100;

  let text = '';
  if (amount >= 10000000) {
    // 1 Crore = 10,000,000
    const cr = amount / 10000000;
    text = `${parseFloat(cr.toFixed(1))}Cr`;
  } else if (amount >= 100000) {
    // 1 Lakh = 100,000
    const l = amount / 100000;
    text = `${parseFloat(l.toFixed(1))}L`;
  } else if (amount >= 1000) {
    // 1 Thousand = 1,000
    const k = amount / 1000;
    text = `${parseFloat(k.toFixed(1))}K`;
  } else {
    text = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return isNegative ? `-${CURRENCY_SYMBOL}${text}` : `${CURRENCY_SYMBOL}${text}`;
}

/**
 * Formats ISO timestamps into Indian format: DD MMM YYYY (e.g. 20 Oct 2026) in IST (Asia/Kolkata).
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat(LOCALE, {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Formats ISO timestamps into Indian format with time: DD MMM YYYY, hh:mm a in IST (Asia/Kolkata).
 */
export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat(LOCALE, {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return dateString;
  }
}
