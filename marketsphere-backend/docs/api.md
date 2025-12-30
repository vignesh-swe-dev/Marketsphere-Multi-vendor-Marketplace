# MarketSphere API Documentation (/api/v1)

## 1. Authentication & Users
- `GET /api/v1/auth/users`: List registered personas for instant switching and auditing.
- `POST /api/v1/auth/login`: Authenticate via email credentials; returns user, seller profile, and shop slug.
- `POST /api/v1/auth/register`: Create a customer or vendor account.

## 2. Product Catalog
- `GET /api/v1/products`: Search and filter catalog items by `category`, `seller`, `search`, `minPrice`, `maxPrice`, `status`, and `sort`. Returns products with variant arrays and inventory totals.
- `GET /api/v1/products/:id`: Detailed view of a single product with variants, seller shop details, shipping policies, and customer reviews.
- `GET /api/v1/categories`: List marketplace taxonomy categories and baseline commission rates.

## 3. Shops & Vendors
- `GET /api/v1/shops/:slug`: Public storefront for an independent vendor with verified badges, bio, policies, and products.
- `POST /api/v1/seller/applications`: Submit vendor onboarding application with EIN, Tax ID, contact, and direct deposit bank details.
- `GET /api/v1/seller/dashboard?sellerId=...`: Seller operations KPIs (Gross sales, net earnings, available balance, commissions paid, suborders count).
- `GET /api/v1/seller/orders?sellerId=...`: Suborders assigned exclusively to this seller with customer shipping addresses and item snapshots.
- `PATCH /api/v1/seller/orders/:id/fulfillment`: Dispatch suborder with `shippingCarrier` and `trackingNumber`.
- `POST /api/v1/seller/products`: Submit a new product with variants and initial stock for administrator moderation.

## 4. Multi-Vendor Checkout & Payments
- `POST /api/v1/checkout/quote`: Server-authoritative price recalculation. Groups items by vendor, computes multi-vendor shipping, allocates coupon discounts in integer cents, estimates sales tax, and forecasts commission splits.
- `POST /api/v1/checkout/order`: Atomically creates master `Order` and vendor-specific `SellerOrder` records, validates stock, and provisions a payment session.
- `POST /api/v1/payments/verify-and-capture`: Verifies gateway payment results, updates order status, commits inventory, and creates balanced double-entry ledger postings.
- `POST /api/v1/webhooks/payments/sandbox`: Signed webhook endpoint verifying incoming HMAC-SHA256 signatures (`x-marketsphere-signature`) and processing payment lifecycle events idempotently.

## 5. Administration & Moderation
- `GET /api/v1/admin/analytics`: Real-time aggregated KPIs (GMV, platform commission revenues, active sellers, pending applications, moderation queues).
- `GET /api/v1/admin/sellers`: Review all vendor onboarding profiles.
- `PATCH /api/v1/admin/sellers/:id/status`: Approve or reject vendor applications. On approval, automatically activates the vendor's public shop and upgrades user role.
- `GET /api/v1/admin/products/moderation`: Queue of seller-submitted products with status `PENDING_REVIEW`.
- `PATCH /api/v1/admin/products/:id/moderation`: Approve and publish products or reject with feedback.
- `GET /api/v1/admin/commission-rules`: List precedence hierarchy of commission rules.
- `POST /api/v1/admin/commission-rules`: Add default, category-specific, or seller-specific commission rate overrides.
- `GET /api/v1/admin/ledger`: Audit all append-only double-entry ledger transactions.
- `POST /api/v1/admin/refunds`: Issue partial or full order refunds with compensating balanced ledger reversal entries.
- `GET /api/v1/admin/audit-logs`: Complete security audit trail of all mutations.
