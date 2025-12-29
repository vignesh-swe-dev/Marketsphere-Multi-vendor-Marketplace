# MarketSphere database (MongoDB)

MongoDB with Mongoose models in `src/models/`. Money is stored as whole numbers in **paise** (100 paise = Rs 1),
for example Rs 2,399.00 is `239900`. Field names end in `Paise`.

| Collection | Purpose |
|---|---|
| `users` | Accounts, roles (CUSTOMER, SELLER, ADMIN, SUPPORT), saved addresses |
| `sellerprofiles`, `shops` | Seller business details and public storefronts |
| `categories`, `products`, `productvariants` | Catalogue. Stock lives on each variant (`inventoryQuantity`) |
| `orders`, `sellerorders`, `orderitems` | One customer order is split into one suborder per seller |
| `payments` | Payment sessions and results |
| `ledgerentries` | Append-only double-entry ledger (for every order, debits equal credits) |
| `commissionrules` | Commission by default, category or seller |
| `coupons`, `reviews`, `auditlogs`, `newslettersubscribers` | Promotions, verified-purchase reviews, admin audit trail, newsletter |

Rules the code enforces:
- Prices and stock are always read from the database, never trusted from the browser.
- Stock is taken with one atomic conditional update inside a transaction, so the last unit can only be sold once.
- Only PUBLISHED products can be bought or listed publicly.

Transactions need a replica set. The local mode and MongoDB Atlas both provide one.
