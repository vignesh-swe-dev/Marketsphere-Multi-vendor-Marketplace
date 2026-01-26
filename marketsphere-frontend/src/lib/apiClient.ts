/**
 * MarketSphere API Client
 *
 * Enforces in-memory-only token storage (XSS resilient), single-flight
 * automatic refresh token rotation on 401, credentials inclusion for httpOnly
 * cookies, and structured error handling.
 */

import { API_BASE } from './api.ts';
import type { User } from '../types/index.ts';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// In-memory token storage ONLY (Never persisted to localStorage or sessionStorage)
let inMemoryAccessToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function onSessionExpired(handler: () => void): () => void {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) {
      sessionExpiredHandler = null;
    }
  };
}

/**
 * Normalizes an API path to the full URL using API_BASE.
 */
function resolveUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

/**
 * Attempts a single-flight token refresh using the httpOnly cookie.
 */
async function performRefreshToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(resolveUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        inMemoryAccessToken = null;
        if (sessionExpiredHandler) {
          sessionExpiredHandler();
        }
        return null;
      }

      const data = await res.json();
      if (data?.accessToken) {
        inMemoryAccessToken = data.accessToken;
        return data.accessToken;
      }

      inMemoryAccessToken = null;
      return null;
    } catch {
      inMemoryAccessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Robust fetch wrapper for all MarketSphere API calls.
 */
export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const url = resolveUrl(path);
  const headers = new Headers(init.headers || {});

  // Add in-memory Bearer token if available and not explicitly provided
  if (inMemoryAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  // Ensure JSON content type by default for requests with bodies
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  // Check for 401 Unauthorized (and not an auth route itself)
  const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/refresh') || path.includes('/auth/register');
  if (response.status === 401 && !isAuthRoute) {
    const newToken = await performRefreshToken();
    if (newToken) {
      // Retry once with the refreshed token
      headers.set('Authorization', `Bearer ${newToken}`);
      const retryResponse = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
      });

      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => null);
        throw new ApiError(
          retryResponse.status,
          errorData?.error?.code || 'API_ERROR',
          errorData?.error?.message || retryResponse.statusText,
          errorData?.error?.details
        );
      }

      return retryResponse.json() as Promise<T>;
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errorData?.error?.code || 'API_ERROR',
      errorData?.error?.message || response.statusText,
      errorData?.error?.details
    );
  }

  return response.json() as Promise<T>;
}

export interface AuthSessionResult {
  user: User;
  accessToken: string;
  expiresIn: number;
}

/**
 * Signs in using real backend credentials.
 */
export async function login(email: string, password: string): Promise<AuthSessionResult> {
  const res = await apiFetch<AuthSessionResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setAccessToken(res.accessToken);
  return res;
}

/**
 * Registers a new user account (Customer or Seller role).
 */
export async function register(payload: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role?: 'CUSTOMER' | 'SELLER';
  businessName?: string;
}): Promise<AuthSessionResult> {
  const res = await apiFetch<AuthSessionResult>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  setAccessToken(res.accessToken);
  return res;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName: string;
  role: 'CUSTOMER' | 'SELLER' | 'ADMIN' | 'SUPPORT';
  phone?: string | null;
  avatarUrl?: string | null;
  isBlocked: boolean;
  createdAt: string;
  shop?: { id: string; name: string; slug: string } | null;
  sellerProfile?: { id: string; status: string } | null;
}

export async function fetchAdminUsers(search?: string, role?: string): Promise<{ users: AdminUserListItem[] }> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (role) params.append('role', role);
  const qs = params.toString();
  return apiFetch<{ users: AdminUserListItem[] }>(`/admin/users${qs ? `?${qs}` : ''}`);
}

export async function updateAdminUserRole(userId: string, role: 'CUSTOMER' | 'SELLER'): Promise<any> {
  return apiFetch(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function toggleAdminUserBlock(userId: string): Promise<any> {
  return apiFetch(`/admin/users/${userId}/block`, {
    method: 'PATCH',
  });
}


/**
 * Signs out, revoking refresh tokens on server and clearing in-memory token.
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore network error on logout
  } finally {
    setAccessToken(null);
  }
}

/**
 * Restores user session on app start from httpOnly refresh cookie.
 */
export async function restoreSession(): Promise<User | null> {
  try {
    const res = await apiFetch<AuthSessionResult>('/auth/refresh', {
      method: 'POST',
    });
    if (res?.accessToken && res?.user) {
      setAccessToken(res.accessToken);
      return res.user;
    }
    return null;
  } catch {
    setAccessToken(null);
    return null;
  }
}

/**
 * Fetches the currently authenticated user's profile and active roles.
 */
export async function fetchMe(): Promise<User | null> {
  try {
    const res = await apiFetch<{ user: User }>('/auth/me');
    return res.user;
  } catch {
    return null;
  }
}
