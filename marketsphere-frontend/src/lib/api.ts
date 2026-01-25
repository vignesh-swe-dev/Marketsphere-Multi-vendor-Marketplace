/**
 * Base URL of the MarketSphere API.
 *
 * - Default '/api/v1' (same origin). In development the Vite dev server proxies /api to the backend
 *   (see vite.config.ts); in Docker/production nginx proxies /api to the backend.
 * - To call a backend on another origin directly, set VITE_API_BASE (for example
 *   https://api.example.com/api/v1). That backend must list this site's origin in its CORS_ORIGINS.
 */
const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
export const API_BASE = (configured || '/api/v1').replace(/\/+$/, '');
