# MarketSphere Architecture Documentation

## 1. System Overview

MarketSphere is an enterprise-ready multi-vendor e-commerce software-as-a-service platform designed with strict boundaries, immutable financial ledgers, and atomic inventory concurrency controls.

```
+-------------------------------------------------------------------------+
|                           Clients & Channels                            |
|             (Web Browser / Mobile Viewport / Desktop PWA)               |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                      MarketSphere Web Application                       |
|               (React 19 + TypeScript + Tailwind CSS UI)                 |
|  - Storefront Catalog               - Seller Hub Operations             |
|  - Multi-Vendor Cart Drawer         - Admin Moderation & Ledger Console |
|  - Multi-Step Checkout Modal        - Customer Orders & Tracking        |
+------------------------------------+------------------------------------+
                                     |
                                     | REST API (/api/v1/*)
                                     v
+------------------------------------+------------------------------------+
|                         Express API Layer                               |
|  - Rate Limiting & Auth             - Commission Precedence Engine      |
|  - Multi-Seller Cart Splitting      - Double-Entry Balanced Ledger      |
|  - Concurrency-Safe Inventory Locks - Signed Webhook Verification       |
+------------------------------------+------------------------------------+
                                     |
        +----------------------------+----------------------------+
        |                                                         |
        v                                                         v
+-------+--------------------+                          +---------+-----------------+
|  Relational Database Layer |                          |    Payment Gateway        |
|  (MongoDB / Atlas)  |                          |  (Sandbox / Stripe / RP)  |
|  - Foreign Key Constraints |                          |  - HMAC-SHA256 Signatures |
|  - Transaction Boundaries  |                          |  - Idempotent Processing  |
|  - Immutable Snapshots     |                          |  - Escrow Ledger Postings |
+----------------------------+                          +---------------------------+
```

## 2. Monorepo & Modular Organization

- **Frontend (`src/components/`, `src/App.tsx`)**: Reactive client layer built with clean component separation, accessible HTML trees, and real-time state synchronization with backend endpoints.
- **Pure Domain Engines (`src/lib/`)**:
  - `commission.ts`: Pure mathematics for discount allocation and commission calculation with explicit precedence (Seller VIP > Category Rate > Platform Default).
  - `ledger.ts`: Append-only balanced accounting engine ensuring Total Debits == Total Credits.
  - `inventory.ts`: Atomic reservation and TTL expiration management to prevent overselling under concurrent checkout load.
- **REST Backend (`src/server/`)**:
  - `api.ts`: Centralized Express routing under `/api/v1` with validation, authorization checks, and audit logging.
  - `payments.ts`: Provider abstraction handling payment sessions, signed HMAC webhook verification, and refund compensation.
  - `db.ts`: MongoDB connection (Atlas or the built-in local database, see `localMongo.ts`), transactions, and demo data seeding.

## 3. Order Lifecycle & Multi-Vendor Split

When a customer checks out products from multiple sellers in one transaction:
1. **Validation & Quote**: Cart items are grouped by `seller_id`. Flat vendor shipping is calculated per package. Coupons are validated and distributed across items in exact integer cents.
2. **Parent Order & Suborders**: The system creates a master `Order` record and independent `SellerOrder` records. Each suborder contains immutable item snapshots (`unit_price_cents`, `allocated_discount_cents`, `commission_rate`, `commission_amount_cents`, `seller_payable_cents`).
3. **Escrow & Ledger Entry**: Customer payment is debited as `GROSS_SALE`. Postings credit `SELLER_PAYABLE`, `MARKETPLACE_COMMISSION`, `TAX_COLLECTED`, and `SHIPPING_COLLECTED`.
4. **Fulfillment Isolation**: Sellers can only view and update their own suborders. Once a seller attaches a carrier tracking number, the suborder status advances to `SHIPPED`.
