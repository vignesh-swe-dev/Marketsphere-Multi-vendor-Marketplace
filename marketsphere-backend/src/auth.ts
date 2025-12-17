/**
 * MarketSphere Authentication & Authorization Module
 * Backed by MongoDB Atlas via Mongoose.
 * Provides JWT access tokens (15m), rotating httpOnly refresh tokens (7d),
 * password hashing (bcrypt cost 12), reuse detection, and role-based access control.
 */

import { makeAsyncSafe } from './lib/asyncRoutes.ts';
import express, { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  UserModel,
  SellerProfileModel,
  ShopModel,
  RefreshTokenModel,
} from './models/index.ts';
import type { UserRole, SellerStatus } from './types/index.ts';

// ----------------------------------------------------
// TypeScript Express Request Extension
// ----------------------------------------------------
export interface AuthContext {
  userId: string;
  role: UserRole;
  sellerProfileId?: string;
  sellerStatus?: SellerStatus;
  shopId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// ----------------------------------------------------
// Standard Error Response Helper
// ----------------------------------------------------
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  return res.status(status).json({
    error: {
      code,
      message,
      requestId: `req_${crypto.randomUUID().slice(0, 8)}`,
      details,
    },
  });
}

// ----------------------------------------------------
// Secret Key Validation & Resolution
// ----------------------------------------------------
const DEV_DEFAULT_KEYWORDS = ['dev', 'change', 'placeholder', 'example'];
let ephemeralDevSecret: string | null = null;

export function getJwtSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!secret || secret.length < 32) {
      throw new Error('FATAL: JWT_ACCESS_SECRET must be set and at least 32 characters long in production.');
    }
    const lower = secret.toLowerCase();
    if (DEV_DEFAULT_KEYWORDS.some((kw) => lower.includes(kw))) {
      throw new Error('FATAL: JWT_ACCESS_SECRET appears to be an insecure placeholder default.');
    }
    return secret;
  }

  if (secret) {
    return secret;
  }

  if (!ephemeralDevSecret) {
    // Keep one development secret on disk so logins survive a server restart (tsx watch restarts often).
    const file = path.resolve('./data/.dev-jwt-secret');
    try {
      ephemeralDevSecret = fs.readFileSync(file, 'utf8').trim();
    } catch {
      /* first run */
    }
    if (!ephemeralDevSecret || ephemeralDevSecret.length < 32) {
      ephemeralDevSecret = crypto.randomBytes(32).toString('hex');
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, ephemeralDevSecret, { mode: 0o600 });
      } catch {
        console.warn('[AUTH WARNING] Could not save the development secret; logins will reset when the server restarts.');
      }
    }
  }
  return ephemeralDevSecret;
}

// ----------------------------------------------------
// Password Policy & Timing-Attack Mitigation
// ----------------------------------------------------
const DUMMY_HASH = bcrypt.hashSync('MarketSphereDummyTimingMitigation#99', 12);

export function validatePasswordRules(password: string): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 72) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
}

// ----------------------------------------------------
// In-Memory Login Rate Limiting (8 failed per IP+email per 15m)
// ----------------------------------------------------
interface FailedLoginRecord {
  attempts: number;
  lastAttempt: number;
}
const loginThrottleMap = new Map<string, FailedLoginRecord>();
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;

export function checkLoginThrottle(ip: string, email: string): boolean {
  const key = `${ip}::${email.toLowerCase()}`;
  const now = Date.now();
  const rec = loginThrottleMap.get(key);

  if (!rec) return true;
  if (now - rec.lastAttempt > THROTTLE_WINDOW_MS) {
    loginThrottleMap.delete(key);
    return true;
  }
  return rec.attempts < MAX_FAILED_ATTEMPTS;
}

export function recordFailedLogin(ip: string, email: string) {
  const key = `${ip}::${email.toLowerCase()}`;
  const now = Date.now();
  const rec = loginThrottleMap.get(key);
  if (!rec || now - rec.lastAttempt > THROTTLE_WINDOW_MS) {
    loginThrottleMap.set(key, { attempts: 1, lastAttempt: now });
  } else {
    rec.attempts += 1;
    rec.lastAttempt = now;
  }
}

export function clearFailedLogin(ip: string, email: string) {
  const key = `${ip}::${email.toLowerCase()}`;
  loginThrottleMap.delete(key);
}

// ----------------------------------------------------
// Refresh Token Utilities
// ----------------------------------------------------
export const REFRESH_COOKIE_NAME = 'ms_refresh';
const REFRESH_EXPIRY_DAYS = 7;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setRefreshCookie(res: Response, rawToken: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

export function clearRefreshCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/v1/auth',
  });
}

// ----------------------------------------------------
// Session Builder
// ----------------------------------------------------
export async function buildUserSession(
  userId: string,
  res?: Response,
  existingFamilyId?: string
) {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new Error(`User not found for id ${userId}`);
  }

  const sellerProfile = await SellerProfileModel.findOne({ userId });
  const shop = sellerProfile ? await ShopModel.findOne({ sellerId: sellerProfile.id }) : null;

  // 1. Generate Access Token (15m expiry)
  const accessToken = jwt.sign(
    { sub: user.id },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '15m' }
  );

  // 2. Generate and store Rotating Refresh Token if res is provided
  if (res) {
    const rawRefreshToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = hashToken(rawRefreshToken);
    const familyId = existingFamilyId || `fam_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await RefreshTokenModel.create({
      _id: `rt_${crypto.randomUUID()}`,
      tokenHash,
      userId: user.id,
      familyId,
      isRevoked: false,
      expiresAt,
    });

    setRefreshCookie(res, rawRefreshToken);
  }

  return {
    accessToken,
    expiresIn: 900, // 15 minutes in seconds
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      phone: user.phone || null,
      avatarUrl: user.avatarUrl || null,
      createdAt: user.createdAt.toISOString(),
      isBlocked: user.isBlocked,
    },
    sellerProfile: sellerProfile
      ? {
          id: sellerProfile.id,
          businessName: sellerProfile.businessName,
          status: sellerProfile.status as SellerStatus,
        }
      : null,
    shop: shop
      ? {
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
        }
      : null,
  };
}

// ----------------------------------------------------
// Authentication & Role Middlewares
// ----------------------------------------------------
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { sub?: string };
    if (!decoded || !decoded.sub) {
      return sendError(res, 401, 'INVALID_TOKEN', 'Token subject identifier is missing');
    }

    // Load active user directly from MongoDB to enforce instant revocation/role changes
    const user = await UserModel.findById(decoded.sub);
    if (!user || user.isBlocked) {
      return sendError(res, 401, 'INVALID_TOKEN', 'User account does not exist or has been blocked');
    }

    const sellerProfile = await SellerProfileModel.findOne({ userId: user.id });
    const shop = sellerProfile ? await ShopModel.findOne({ sellerId: sellerProfile.id }) : null;

    req.auth = {
      userId: user.id,
      role: user.role as UserRole,
      sellerProfileId: sellerProfile?.id,
      sellerStatus: sellerProfile?.status as SellerStatus,
      shopId: shop?.id,
    };

    return next();
  } catch (err: any) {
    return sendError(res, 401, 'INVALID_TOKEN', 'Access token is invalid or expired');
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.auth) {
    return next();
  }

  // If optionalAuth hasn't run yet, run it
  optionalAuth(req, res, () => {
    if (!req.auth) {
      return sendError(res, 401, 'AUTH_REQUIRED', 'Authentication is required for this route');
    }
    next();
  });
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      if (!req.auth || !roles.includes(req.auth.role)) {
        return sendError(res, 403, 'FORBIDDEN', 'Forbidden: insufficient role permissions');
      }
      next();
    });
  };
}

export function requireApprovedSeller(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.auth) return;
    if (req.auth.role !== 'SELLER' || req.auth.sellerStatus !== 'APPROVED') {
      return sendError(res, 403, 'FORBIDDEN', 'Forbidden: approved seller status is required');
    }
    next();
  });
}

// ----------------------------------------------------
// Auth Express Router (/api/v1/auth)
// ----------------------------------------------------
export const authRouter = makeAsyncSafe(Router());

/**
 * POST /api/v1/auth/register
 * Creates a new user with CUSTOMER or SELLER role.
 * Public registration strictly forbids creating ADMIN accounts (defaults to CUSTOMER).
 */
authRouter.post('/register', async (req, res) => {
  const { email, password, fullName, phone, role, businessName } = req.body || {};

  // Email format check
  if (!email || typeof email !== 'string') {
    return sendError(res, 400, 'INVALID_EMAIL', 'A valid email address is required');
  }
  const cleanEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return sendError(res, 400, 'INVALID_EMAIL', 'Invalid email address format');
  }

  // Full name check (2 to 100 chars)
  if (!fullName || typeof fullName !== 'string') {
    return sendError(res, 400, 'INVALID_NAME', 'Full name is required (2 to 100 characters)');
  }
  const cleanName = fullName.trim();
  if (cleanName.length < 2 || cleanName.length > 100) {
    return sendError(res, 400, 'INVALID_NAME', 'Full name must be between 2 and 100 characters');
  }

  // Password rules (8 to 72 chars, letter + number)
  if (!validatePasswordRules(password)) {
    return sendError(
      res,
      400,
      'INVALID_PASSWORD',
      'Password must be 8 to 72 characters long and contain at least one letter and one number'
    );
  }

  // Duplicate email check
  const existing = await UserModel.findOne({ email: cleanEmail });
  if (existing) {
    return sendError(res, 409, 'EMAIL_EXISTS', 'An account with this email address already exists');
  }

  // Role assignment:
  // Public registration allows 'CUSTOMER' or 'SELLER'.
  // Any attempt to request 'ADMIN' or unknown role is strictly prevented and forced to 'CUSTOMER'.
  let assignedRole: UserRole = 'CUSTOMER';
  if (role === 'SELLER') {
    assignedRole = 'SELLER';
  }

  const userId = `user_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(password, 12);
  const cleanPhone = phone && typeof phone === 'string' ? phone.trim() : undefined;

  await UserModel.create({
    _id: userId,
    email: cleanEmail,
    fullName: cleanName,
    role: assignedRole,
    phone: cleanPhone,
    passwordHash,
  });

  // If registered as SELLER, initialize an approved seller profile and shop
  if (assignedRole === 'SELLER') {
    const profileId = `seller-prof-${crypto.randomUUID()}`;
    const shopName = (businessName && typeof businessName === 'string' && businessName.trim())
      ? businessName.trim()
      : `${cleanName}'s Store`;

    const baseSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seller-shop';
    let slug = baseSlug;
    for (let n = 2; await ShopModel.exists({ slug }); n++) {
      slug = `${baseSlug}-${n}`;
    }

    const now = new Date();
    await SellerProfileModel.create({
      _id: profileId,
      userId,
      businessName: shopName,
      contactEmail: cleanEmail,
      contactPhone: cleanPhone || '+91 99999 99999',
      status: 'APPROVED',
      appliedAt: now,
      approvedAt: now,
    });

    await ShopModel.create({
      _id: `shop-${crypto.randomUUID()}`,
      sellerId: profileId,
      name: shopName,
      slug,
      tagline: 'Verified independent vendor on MarketSphere',
      description: 'Curated products with quality assurance and direct vendor fulfillment.',
      rating: 5.0,
      reviewCount: 0,
      isActive: true,
    });
  }

  const session = await buildUserSession(userId, res);
  return res.status(201).json(session);
});

/**
 * POST /api/v1/auth/setup-admin
 * Secure, restricted setup process to create the initial Admin account.
 * Prohibits creating additional Admin accounts once one exists.
 */
authRouter.post('/setup-admin', async (req, res) => {
  // Check if an Admin account already exists
  const existingAdminCount = await UserModel.countDocuments({ role: 'ADMIN' });
  if (existingAdminCount >= 1) {
    return sendError(
      res,
      403,
      'ADMIN_EXISTS',
      'System setup is already complete. Only one Admin account is permitted in the system.'
    );
  }

  const { email, password, fullName, phone, setupKey } = req.body || {};
  const secretKey = process.env.ADMIN_SETUP_SECRET || 'marketsphere-secure-admin-setup';

  // Verify setup authorization key
  const authHeader = req.headers['x-admin-setup-key'];
  if (setupKey !== secretKey && authHeader !== secretKey) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or missing admin setup authorization key');
  }

  if (!email || !password || !fullName) {
    return sendError(res, 400, 'MISSING_FIELDS', 'Email, password, and full name are required for admin setup');
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = fullName.trim();

  if (!validatePasswordRules(password)) {
    return sendError(
      res,
      400,
      'INVALID_PASSWORD',
      'Password must be 8 to 72 characters long and contain at least one letter and one number'
    );
  }

  const existingEmail = await UserModel.findOne({ email: cleanEmail });
  if (existingEmail) {
    return sendError(res, 409, 'EMAIL_EXISTS', 'An account with this email address already exists');
  }

  const userId = `user-admin-${Date.now()}`;
  const passwordHash = await bcrypt.hash(password, 12);
  const cleanPhone = phone && typeof phone === 'string' ? phone.trim() : undefined;

  const adminUser = await UserModel.create({
    _id: userId,
    email: cleanEmail,
    fullName: cleanName,
    role: 'ADMIN',
    phone: cleanPhone,
    passwordHash,
  });

  const session = await buildUserSession(adminUser.id, res);
  return res.status(201).json({
    success: true,
    message: 'Primary Administrator account created successfully',
    session,
  });
});

/**
 * POST /api/v1/auth/login
 * Validates credentials with dummy timing mitigation and rate limiting.
 */
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return sendError(res, 400, 'MISSING_CREDENTIALS', 'Email and password are required');
  }

  const cleanEmail = email.toLowerCase().trim();

  // Rate limiting check: 8 failed attempts per IP+email per 15 minutes
  if (!checkLoginThrottle(ip, cleanEmail)) {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Please try again in 15 minutes.');
  }

  // Lookup user by email
  const user = await UserModel.findOne({ email: cleanEmail });

  if (user && user.lockoutUntil && user.lockoutUntil > new Date()) {
    return sendError(res, 423, 'ACCOUNT_LOCKED', 'Account temporarily locked due to repeated failed logins. Please try again later.');
  }

  // Always run bcrypt comparison to mitigate timing discovery attacks
  const hashToCompare = user && user.passwordHash ? user.passwordHash : DUMMY_HASH;
  const isMatch = await bcrypt.compare(password, hashToCompare);

  if (!user || !user.passwordHash || !isMatch) {
    recordFailedLogin(ip, cleanEmail);
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();
    }
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.isBlocked) {
    return sendError(res, 403, 'ACCOUNT_BLOCKED', 'Account has been suspended by administration');
  }

  // Reset failed attempts on success
  if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
    user.failedLoginAttempts = 0;
    user.lockoutUntil = undefined;
    await user.save();
  }
  clearFailedLogin(ip, cleanEmail);

  const session = await buildUserSession(user.id, res);
  return res.json(session);
});

/**
 * POST /api/v1/auth/refresh
 * Rotates refresh token cookie and issues a fresh 15-minute access token.
 * Detects token replay / theft and revokes all user sessions.
 */
authRouter.post('/refresh', async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    return sendError(res, 401, 'AUTH_REQUIRED', 'Refresh token cookie is missing');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenRecord = await RefreshTokenModel.findOne({ tokenHash });

  if (!tokenRecord) {
    clearRefreshCookie(res);
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid refresh token session');
  }

  // THEFT DETECTION: If a revoked token is replayed, revoke ALL tokens in this family/user!
  if (tokenRecord.isRevoked) {
    await RefreshTokenModel.updateMany(
      { familyId: tokenRecord.familyId },
      { $set: { isRevoked: true } }
    );
    clearRefreshCookie(res);
    return sendError(res, 401, 'TOKEN_REPLAY_DETECTED', 'Session security breach detected; all sessions revoked.');
  }

  // Check expiration
  if (tokenRecord.expiresAt <= new Date()) {
    tokenRecord.isRevoked = true;
    await tokenRecord.save();
    clearRefreshCookie(res);
    return sendError(res, 401, 'TOKEN_EXPIRED', 'Refresh token expired; please sign in again');
  }

  // Check user still exists
  const user = await UserModel.findById(tokenRecord.userId);
  if (!user || user.isBlocked) {
    clearRefreshCookie(res);
    return sendError(res, 401, 'INVALID_TOKEN', 'User account does not exist or has been blocked');
  }

  // Revoke old token and rotate
  tokenRecord.isRevoked = true;
  await tokenRecord.save();

  const session = await buildUserSession(user.id, res, tokenRecord.familyId);
  return res.json(session);
});

/**
 * POST /api/v1/auth/logout
 * Revokes current refresh token and clears cookie.
 */
authRouter.post('/logout', async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawRefreshToken && typeof rawRefreshToken === 'string') {
    const tokenHash = hashToken(rawRefreshToken);
    await RefreshTokenModel.updateOne({ tokenHash }, { $set: { isRevoked: true } });
  }

  clearRefreshCookie(res);
  return res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/v1/auth/me
 * Returns current authenticated session payload.
 */
authRouter.get('/me', requireAuth, async (req, res) => {
  if (!req.auth?.userId) {
    return sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required');
  }
  const session = await buildUserSession(req.auth.userId);
  return res.json(session);
});
