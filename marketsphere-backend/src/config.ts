/**
 * MarketSphere Backend Configuration
 * Centralized configuration for currency, taxes, and shipping rules.
 */

export const CURRENCY = process.env.CURRENCY || 'INR';
export const GST_RATE_PERCENT = Number(process.env.GST_RATE_PERCENT) || 18;
export const FLAT_SHIPPING_PAISE = Number(process.env.FLAT_SHIPPING_PAISE) || 4900; // ₹49 per seller package
export const FREE_SHIPPING_THRESHOLD_PAISE = Number(process.env.FREE_SHIPPING_THRESHOLD_PAISE) || 99900; // Free shipping at ₹999+
