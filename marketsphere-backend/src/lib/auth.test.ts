import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../app.ts';
import { SellerOrderModel, UserModel } from '../models/index.ts';
import { startTestDb } from './testDb.ts';

process.env.NODE_ENV = 'development';

let server: Server;
let baseUrl: string;
let stopDb: () => Promise<void>;

test.before(async () => {
  stopDb = await startTestDb();
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await stopDb();
});

test('email-only login is rejected with 400', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@example.com' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json() as any;
  assert.equal(data.error.code, 'MISSING_CREDENTIALS');
});

test('login with wrong password returns 401', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@example.com', password: 'IncorrectPassword99' }),
  });
  assert.equal(res.status, 401);
  const data = await res.json() as any;
  assert.equal(data.error.code, 'INVALID_CREDENTIALS');
});

test('correct login returns a token and never returns password_hash', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@example.com', password: 'Demo@12345' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json() as any;
  assert.ok(data.accessToken, 'Must contain accessToken');
  assert.equal(data.user.email, 'customer@example.com');
  assert.equal(data.user.role, 'CUSTOMER');
  assert.equal(data.user.password_hash, undefined, 'Must not leak password_hash');
  assert.equal(data.user.passwordHash, undefined, 'Must not leak passwordHash');
});

test('register always creates a CUSTOMER even if role: ADMIN is sent', async () => {
  const uniqueEmail = `test-user-${Date.now()}@example.com`;
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Test User',
      email: uniqueEmail,
      password: 'StrongPassword123!',
      role: 'ADMIN', // malicious attempt to escalate privilege
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json() as any;
  assert.equal(data.user.role, 'CUSTOMER', 'Role must be forced to CUSTOMER');
  assert.ok(data.accessToken);

  // Verify in DB directly
  const row = await UserModel.findOne({ email: uniqueEmail }).lean();
  assert.equal(row?.role, 'CUSTOMER');
});

test('register as SELLER creates a SELLER user, approved sellerProfile, and active shop', async () => {
  const uniqueEmail = `test-seller-${Date.now()}@example.com`;
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Vikram Craftworks',
      email: uniqueEmail,
      password: 'StrongPassword123!',
      role: 'SELLER',
      businessName: 'Vikram Artisanal Studios',
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json() as any;
  assert.equal(data.user.role, 'SELLER');
  assert.ok(data.sellerProfile);
  assert.equal(data.sellerProfile.businessName, 'Vikram Artisanal Studios');
  assert.equal(data.sellerProfile.status, 'APPROVED');
  assert.ok(data.shop);
  assert.equal(data.shop.name, 'Vikram Artisanal Studios');
});

test('single Admin constraint: setup-admin fails when Admin already exists, and DB hook blocks second Admin', async () => {
  // Try calling setup-admin when admin already exists
  const setupRes = await fetch(`${baseUrl}/auth/setup-admin`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-admin-setup-key': 'marketsphere-secure-admin-setup'
    },
    body: JSON.stringify({
      fullName: 'Second Admin',
      email: 'admin2@example.com',
      password: 'StrongPassword123!',
    }),
  });
  assert.equal(setupRes.status, 403);
  const setupData = await setupRes.json() as any;
  assert.equal(setupData.error.code, 'ADMIN_EXISTS');

  // Try saving second admin directly through Mongoose model
  await assert.rejects(
    async () => {
      await UserModel.create({
        email: `illegal-admin-${Date.now()}@example.com`,
        fullName: 'Illegal Admin',
        role: 'ADMIN',
      });
    },
    /Only one Admin account is permitted/
  );
});

test('Admin can list users and update roles between CUSTOMER and SELLER, but cannot assign ADMIN or demote Admin', async () => {
  // Login as admin
  const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@marketsphere.in', password: 'Demo@12345' }),
  });
  assert.equal(adminLoginRes.status, 200);
  const { accessToken: adminToken, user: adminUser } = await adminLoginRes.json() as any;

  // 1. List users
  const listRes = await fetch(`${baseUrl}/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json() as any;
  assert.ok(Array.isArray(listData.users));
  assert.ok(listData.users.length > 0);

  // 2. Create a customer to test role change
  const custEmail = `cust-to-seller-${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Rahul Verma',
      email: custEmail,
      password: 'StrongPassword123!',
      role: 'CUSTOMER',
    }),
  });
  const { user: newCust } = await regRes.json() as any;
  assert.equal(newCust.role, 'CUSTOMER');

  // 3. Admin promotes customer to SELLER
  const promoteRes = await fetch(`${baseUrl}/admin/users/${newCust.id}/role`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}` 
    },
    body: JSON.stringify({ role: 'SELLER' }),
  });
  assert.equal(promoteRes.status, 200);
  const promoteData = await promoteRes.json() as any;
  assert.equal(promoteData.user.role, 'SELLER');

  // 4. Admin demotes seller back to CUSTOMER
  const demoteRes = await fetch(`${baseUrl}/admin/users/${newCust.id}/role`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}` 
    },
    body: JSON.stringify({ role: 'CUSTOMER' }),
  });
  assert.equal(demoteRes.status, 200);
  const demoteData = await demoteRes.json() as any;
  assert.equal(demoteData.user.role, 'CUSTOMER');

  // 5. Attempting to assign ADMIN role is rejected with 400
  const illegalRoleRes = await fetch(`${baseUrl}/admin/users/${newCust.id}/role`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}` 
    },
    body: JSON.stringify({ role: 'ADMIN' }),
  });
  assert.equal(illegalRoleRes.status, 400);

  // 6. Attempting to demote or change the role of the primary Admin is rejected with 403
  const demoteAdminRes = await fetch(`${baseUrl}/admin/users/${adminUser.id}/role`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}` 
    },
    body: JSON.stringify({ role: 'CUSTOMER' }),
  });
  assert.equal(demoteAdminRes.status, 403);
});

test('no token gives 401 on /admin/*, /orders, /seller/orders', async () => {
  const r1 = await fetch(`${baseUrl}/admin/ledger`);
  assert.equal(r1.status, 401);

  const r2 = await fetch(`${baseUrl}/orders`);
  assert.equal(r2.status, 401);

  const r3 = await fetch(`${baseUrl}/seller/orders`);
  assert.equal(r3.status, 401);
});

test('a customer token gets 403 on /admin/*', async () => {
  // Login as customer
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@example.com', password: 'Demo@12345' }),
  });
  const { accessToken } = await loginRes.json() as any;

  const res = await fetch(`${baseUrl}/admin/ledger`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(res.status, 403);
  const data = await res.json() as any;
  assert.equal(data.error.code, 'FORBIDDEN');
});

test("a seller cannot fulfil another seller's suborder (404)", async () => {
  // Login as seller 1 (seller@apexelectronics.com)
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seller@apexelectronics.com', password: 'Demo@12345' }),
  });
  const { accessToken } = await loginRes.json() as any;

  // Find a seller order belonging to seller 2 or create dummy suborder for seller-prof-2
  const suborder = await SellerOrderModel.findOne({ sellerId: { $ne: 'seller-prof-1' } }).lean();
  assert.ok(suborder, 'Should have suborder for another seller');

  const res = await fetch(`${baseUrl}/seller/orders/${suborder._id}/fulfillment`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      shippingCarrier: 'Blue Dart',
      trackingNumber: 'BLUDART-12345678',
      status: 'SHIPPED',
    }),
  });
  assert.equal(res.status, 404);
  const data = await res.json() as any;
  assert.equal(data.error.code, 'NOT_FOUND');
});

test('refresh rotation works and replaying an old refresh cookie is rejected', async () => {
  // Login to obtain refresh cookie
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@example.com', password: 'Demo@12345' }),
  });
  assert.equal(loginRes.status, 200);

  // Extract Set-Cookie header
  const setCookie = loginRes.headers.get('set-cookie');
  assert.ok(setCookie, 'Must set refresh cookie');
  const cookieMatch = setCookie.match(/ms_refresh=([^;]+)/);
  assert.ok(cookieMatch, 'Must find ms_refresh cookie');
  const oldCookie = cookieMatch[1];

  // Refresh #1 using the fresh cookie
  const refresh1Res = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `ms_refresh=${oldCookie}` },
  });
  assert.equal(refresh1Res.status, 200);
  const r1Data = await refresh1Res.json() as any;
  assert.ok(r1Data.accessToken, 'Refresh 1 must return a new access token');

  const newSetCookie = refresh1Res.headers.get('set-cookie');
  assert.ok(newSetCookie, 'Must set a new rotated cookie');
  const newCookieMatch = newSetCookie.match(/ms_refresh=([^;]+)/);
  assert.ok(newCookieMatch);
  const newCookie = newCookieMatch[1];
  assert.notEqual(oldCookie, newCookie, 'Refresh token must rotate to a new value');

  // Rotated new cookie works
  const refresh2Res = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `ms_refresh=${newCookie}` },
  });
  assert.equal(refresh2Res.status, 200, 'Rotated new cookie must succeed');
  const r2Data = await refresh2Res.json() as any;
  assert.ok(r2Data.accessToken);

  // Attempt replay of the OLD revoked cookie -> must be rejected
  const replayRes = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `ms_refresh=${oldCookie}` },
  });
  assert.equal(replayRes.status, 401, 'Replay of old refresh cookie must be 401');
  const replayData = await replayRes.json() as any;
  assert.equal(replayData.error.code, 'TOKEN_REPLAY_DETECTED');
});
