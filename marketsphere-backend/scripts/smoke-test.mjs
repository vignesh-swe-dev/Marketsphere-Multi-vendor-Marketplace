// End-to-end check of the running API: accounts, catalogue, checkout, payment, orders, refunds,
// reviews, seller tools, admin tools and access control.
//
//   Terminal 1:  npm run dev
//   Terminal 2:  npm run smoke
//
// Needs the demo data (the default in development). Creates its own test accounts (smoke-*@example.com).
const BASE = process.env.API_URL || 'http://localhost:4000/api/v1';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@12345';

class Client {
  token = '';
  cookie = '';
  async call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(';')[0];
      this.cookie = pair.endsWith('=') ? '' : pair;
    }
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  async login(email, password = DEMO_PASSWORD) {
    const r = await this.call('POST', '/auth/login', { email, password });
    if (r.status === 200) this.token = r.data.accessToken;
    return r;
  }
}

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS', name); }
  else { failed++; console.log('  FAIL', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 300)); }
}

const anon = new Client(), customer = new Client(), other = new Client(), seller = new Client(), admin = new Client(), applicant = new Client();
const stamp = Date.now();
let r;

console.log('Public catalogue');
r = await anon.call('GET', '/health'); check('health', r.status === 200 && r.data.status === 'ok', r);
r = await anon.call('GET', '/categories'); check('categories', r.status === 200 && (r.data.categories?.length ?? r.data.length) > 0, r.data);
r = await anon.call('GET', '/products?status=PUBLISHED'); check('published products', r.status === 200 && r.data.products?.length > 0, r.data);
// ignore products created by earlier smoke runs, so the test can be repeated on the same database
const products = (r.data.products ?? []).filter((p) => !/^(Last Unit|Smoke Test|Bad Stock)/.test(p.name));
const p1 = products[0], p2 = products[1];
r = await anon.call('GET', `/products/${p1.id}`); check('product detail', r.status === 200 && r.data.product?.id === p1.id, r.data);
r = await anon.call('GET', '/products?search=' + encodeURIComponent(p1.name.split(' ')[0])); check('search', r.status === 200 && r.data.products.length > 0, r.data);
r = await anon.call('GET', '/products/does-not-exist'); check('unknown product = 404', r.status === 404, r.status);
const shopSlug = p1.shop?.slug ?? p1.shopSlug;
if (shopSlug) { r = await anon.call('GET', `/shops/${shopSlug}`); check('shop page', r.status === 200, r.data); }

console.log('Accounts');
const email = `smoke-c-${stamp}@example.com`;
r = await anon.call('POST', '/auth/register', { email, password: 'Smoke@12345', fullName: 'Smoke Customer', role: 'ADMIN' });
check('register', r.status === 201 || r.status === 200, r.data);
check('register ignores role=ADMIN', (r.data?.user?.role ?? 'CUSTOMER') === 'CUSTOMER', r.data?.user);
r = await new Client().login(email, 'wrong-password'); check('wrong password = 401', r.status === 401, r.status);
r = await customer.login(email, 'Smoke@12345'); check('login', r.status === 200 && !!r.data.accessToken, r.data);
r = await customer.call('GET', '/auth/me'); check('me', r.status === 200 && r.data.user?.email === email, r.data);
r = await new Client().call('GET', '/auth/me'); check('me without token = 401', r.status === 401, r.status);
r = await customer.call('POST', '/auth/refresh'); check('refresh token', r.status === 200 && !!r.data.accessToken, r.data);
if (r.status === 200) customer.token = r.data.accessToken;
await other.login('priya.sharma@example.in'); check('second customer login', !!other.token);

console.log('Access control');
r = await customer.call('GET', '/admin/analytics'); check('customer blocked from admin', r.status === 403, r.status);
r = await anon.call('GET', '/admin/analytics'); check('anonymous blocked from admin', r.status === 401, r.status);
r = await customer.call('GET', '/seller/dashboard'); check('customer blocked from seller area', r.status === 403, r.status);
r = await anon.call('GET', '/orders'); check('orders need login', r.status === 401, r.status);

r = await customer.call('GET', '/products?status=ALL'); check('customer cannot list unpublished products', r.status === 403, r.status);
r = await anon.call('GET', '/products?status=ALL'); check('anonymous cannot list unpublished products', r.status === 401, r.status);
r = await anon.call('GET', '/products?status[$ne]=PUBLISHED'); check('operator injection in query is harmless', r.status === 200 && r.data.products.every((p) => p.status === 'PUBLISHED'), r.status);
r = await anon.call('POST', '/auth/login', { email: { $ne: null }, password: { $ne: null } }); check('operator injection in login rejected', r.status === 400 || r.status === 401, r.status);
r = await anon.call('GET', '/products?search=' + encodeURIComponent('(a+)+$')); check('hostile search text is safe', r.status === 200, r.status);

console.log('Checkout and payment');
const v1 = p1.variants?.[0]?.id, v2 = p2.variants?.[0]?.id;
const cart = [{ productId: p1.id, variantId: v1, quantity: 2 }, { productId: p2.id, variantId: v2, quantity: 1 }];
r = await customer.call('POST', '/checkout/quote', { items: [{ productId: p1.id, quantity: 1 }] });
if (p1.variants?.length > 1) check('multi-option product needs an option chosen', r.status === 400 && r.data?.error?.code === 'VARIANT_REQUIRED', r.data);
r = await customer.call('POST', '/checkout/quote', { items: cart }); check('quote', r.status === 200 || r.status === 201, r.data);
const quote = r.data;
check('quote has totals', (quote?.totalPaise ?? quote?.quote?.totalPaise) > 0, quote);
const address = { fullName: 'Smoke Customer', streetAddress: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', country: 'IN', phone: '9876543210' };
r = await customer.call('POST', '/checkout/order', { shippingAddress: { ...address, postalCode: '12' }, items: cart }); check('bad PIN code rejected', r.status === 400, r.data);
r = await customer.call('POST', '/checkout/order', { shippingAddress: address, items: [{ productId: p1.id, variantId: v1, quantity: 50 }, { productId: p1.id, variantId: v1, quantity: 50 }, { productId: p1.id, variantId: v1, quantity: 50 }] }); check('splitting one item across lines cannot beat the limits', r.status === 400, r.data);
for (const q of [0, -1, 1.5, 'abc', 51]) {
  r = await customer.call('POST', '/checkout/order', { shippingAddress: address, items: [{ productId: p1.id, variantId: v1, quantity: q }] });
  check(`quantity ${JSON.stringify(q)} rejected`, r.status === 400, r.data);
}
r = await customer.call('POST', '/checkout/order', { shippingAddress: address, items: [{ productId: p1.id, variantId: p2.variants?.[0]?.id ?? 'variant-of-another-product', quantity: 1 }] });
check('foreign/unknown variant rejected', r.status === 400, r.data);
r = await customer.call('POST', '/checkout/order', { shippingAddress: address, items: cart }); check('create order', r.status === 201, r.data);
const order = r.data?.order;
const payId = order?.paymentSession?.providerPaymentId ?? order?.paymentSession?.paymentId ?? order?.paymentSession?.id;
check('order has payment session', !!payId, order?.paymentSession);
r = await customer.call('POST', '/payments/verify-and-capture', { orderId: order.id, providerPaymentId: payId, simulatedSuccess: true }); check('capture payment', r.status === 200 && r.data.success !== false, r.data);
r = await customer.call('GET', '/orders'); check('my orders', r.status === 200 && r.data.orders.some((o) => o.id === order.id), r.data);
r = await customer.call('GET', `/orders/${order.id}`); check('order detail', r.status === 200 && ['PROCESSING', 'PAID', 'CONFIRMED'].includes(r.data.order.status), r.data.order?.status);
r = await other.call('GET', `/orders/${order.id}`); check("other customer cannot read my order", r.status === 403 || r.status === 404, r.status);
r = await customer.call('POST', '/reviews', { productId: p1.id, rating: 5, title: 'Great', comment: 'Works well' }); check('verified-purchase review', r.status === 201, r.data);
r = await customer.call('POST', `/orders/${order.id}/refund-request`, { reason: 'Changed my mind' }); check('refund request', r.status === 200 || r.status === 201, r.data);

console.log('Seller tools');
r = await seller.login('seller@apexelectronics.com'); check('seller login', r.status === 200, r.data);
r = await seller.call('GET', '/seller/dashboard'); check('seller dashboard', r.status === 200, r.data);
r = await seller.call('GET', '/seller/orders'); check('seller orders', r.status === 200 && Array.isArray(r.data.sellerOrders ?? r.data.orders), r.data);
const sOrders = r.data.sellerOrders ?? r.data.orders ?? [];
const toShip = sOrders.find((o) => ['PROCESSING', 'PENDING', 'PAID'].includes(o.status));
if (toShip) { r = await seller.call('PATCH', `/seller/orders/${toShip.id}/fulfillment`, { shippingCarrier: 'Delhivery', trackingNumber: 'DLV123456', status: 'SHIPPED' }); check('ship an order', r.status === 200, r.data); }
r = await seller.call('GET', '/categories'); const cats = r.data.categories ?? r.data;
r = await seller.call('POST', '/seller/products', { categoryId: cats[0].id, name: `Smoke Test Product ${stamp}`, description: 'Created by the smoke test', basePricePaise: 129900, sku: `SMK-${stamp}`, brand: 'Smoke', images: [] });
check('seller creates product', r.status === 201, r.data);
const newProductId = r.data?.product?.id ?? r.data?.productId ?? r.data?.id;
r = await seller.call('GET', '/products?status=ALL'); check("seller sees own products", r.status === 200 && r.data.products.some((p) => p.id === newProductId), r.status);
r = await anon.call('GET', '/products?status=PUBLISHED'); check('new product not public before approval', !r.data.products.some((p) => p.id === newProductId));
r = await seller.call('GET', '/admin/sellers'); check('seller blocked from admin', r.status === 403, r.status);

r = await customer.call('POST', '/checkout/order', { shippingAddress: address, items: [{ productId: newProductId, quantity: 1 }] });
check('unapproved (draft) product cannot be bought', r.status === 400, r.data);
r = await seller.call('POST', '/seller/products', { categoryId: cats[0].id, name: `Last Unit ${stamp}`, description: 'one in stock', basePricePaise: 50000, sku: `LU-${stamp}`, brand: 'Smoke', variants: [{ name: 'Standard', pricePaise: 50000, inventoryQuantity: 1 }] });
check('seller creates 1-unit product', r.status === 201, r.data);
const lastUnitId = r.data?.productId;
r = await seller.call('POST', '/seller/products', { categoryId: cats[0].id, name: `Bad Stock ${stamp}`, basePricePaise: 50000, sku: `BS-${stamp}`, variants: [{ name: 'Std', pricePaise: 50000, inventoryQuantity: -5 }] });
check('negative stock rejected', r.status === 400, r.data);
console.log('Seller application');
const aEmail = `smoke-s-${stamp}@example.com`;
await anon.call('POST', '/auth/register', { email: aEmail, password: 'Smoke@12345', fullName: 'Smoke Applicant' });
await applicant.login(aEmail, 'Smoke@12345');
r = await applicant.call('POST', '/seller/applications', { businessName: 'Smoke Traders', gstin: '29ABCDE1234F1Z5', pan: 'ABCDE1234F', contactEmail: aEmail, contactPhone: '9876543210', ifsc: 'HDFC0001234', bankDetails: { accountNumber: '123456789012', routingOrIfsc: 'HDFC0001234' } });
check('apply to sell', r.status === 201 || r.status === 200, r.data);

console.log('Admin tools');
r = await admin.login('admin@marketsphere.in'); check('admin login', r.status === 200, r.data);
r = await admin.call('GET', '/admin/analytics'); check('analytics', r.status === 200, r.data);
r = await admin.call('GET', '/admin/sellers'); check('sellers list', r.status === 200, r.data);
const sellers = r.data.sellers ?? r.data;
const pending = sellers.find((s) => s.businessName === 'Smoke Traders') ?? sellers.find((s) => s.status === 'PENDING');
if (pending) { r = await admin.call('PATCH', `/admin/sellers/${pending.id}/status`, { status: 'APPROVED' }); check('approve seller', r.status === 200, r.data); }
r = await admin.call('GET', '/admin/products/moderation'); check('moderation queue', r.status === 200, r.data);
if (newProductId) {
  r = await admin.call('PATCH', `/admin/products/${newProductId}/moderation`, { status: 'PUBLISHED' }); check('approve product', r.status === 200, r.data);
  r = await anon.call('GET', '/products?status=PUBLISHED'); check('approved product is public', r.data.products.some((p) => p.id === newProductId));
}
if (lastUnitId) {
  await admin.call('PATCH', `/admin/products/${lastUnitId}/moderation`, { status: 'PUBLISHED' });
  const mk = async (c) => { const o = await c.call('POST', '/checkout/order', { shippingAddress: address, items: [{ productId: lastUnitId, quantity: 1 }] }); return o; };
  const [o1, o2] = [await mk(customer), await mk(other)];
  check('both customers can start checkout for the last unit', o1.status === 201 && o2.status === 201, [o1.status, o2.status]);
  const cap = (c, o) => c.call('POST', '/payments/verify-and-capture', { orderId: o.data.order.id, providerPaymentId: o.data.order.paymentSession.providerPaymentId, simulatedSuccess: true });
  const [c1, c2] = await Promise.all([cap(customer, o1), cap(other, o2)]);
  const wins = [c1, c2].filter((c) => c.status === 200).length;
  check('exactly one customer gets the last unit (no overselling)', wins === 1, [c1.status, c2.status, c1.data, c2.data]);
  r = await anon.call('GET', `/products/${lastUnitId}`);
  const inv = r.data?.product?.inventoryTotal ?? r.data?.product?.variants?.[0]?.inventoryQuantity;
  check('stock never goes below zero', inv === 0, inv);
}
r = await admin.call('GET', '/admin/commission-rules'); check('commission rules', r.status === 200, r.data);
r = await admin.call('POST', '/admin/commission-rules', { scope: 'CATEGORY', targetId: cats[0].id, percentageRate: 12, description: 'smoke' }); check('create commission rule', r.status === 201, r.data);
r = await admin.call('GET', '/admin/ledger'); check('ledger', r.status === 200, r.data);
r = await admin.call('GET', '/admin/audit-logs'); check('audit logs', r.status === 200 && (r.data.logs ?? r.data.auditLogs ?? r.data).length > 0, r.data);
r = await admin.call('PATCH', `/orders/${order.id}/status`, { status: 'DELIVERED' }); check('admin sets order status', r.status === 200, r.data);
r = await admin.call('POST', '/admin/refunds', { orderId: order.id, amountPaise: 1000, reason: 'smoke refund' }); check('admin refund', r.status === 200 || r.status === 201, r.data);

console.log('Reviews and newsletter');
r = await other.call('POST', '/reviews', { productId: p2.id, rating: 5, title: 'x', comment: 'never bought this' });
check('review without purchase rejected', r.status >= 400 && r.status < 500, r.status);
r = await anon.call('POST', '/newsletter/subscribe', { email: `smoke-n-${stamp}@example.com` }); check('newsletter subscribe', r.status === 200 || r.status === 201, r.data);
r = await anon.call('POST', '/newsletter/subscribe', { email: 'not-an-email' }); check('newsletter bad email rejected', r.status === 400 || r.status === 429, r.data);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
