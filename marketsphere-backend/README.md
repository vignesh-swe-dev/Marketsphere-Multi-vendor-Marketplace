# MarketSphere API

REST API for the MarketSphere multi-vendor marketplace: Express 4, TypeScript, MongoDB (Mongoose).
Amounts are stored as whole numbers in paise (100 paise = Rs 1).

## Run it (no database setup needed)

Node.js 20.19 or newer is required.

```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run dev                 # http://localhost:4000/api/v1
```

On the first start the API creates a **local MongoDB** inside `data/mongo` and loads demo data
(shops, products, orders). It uses a MongoDB already installed on your computer, or downloads one
the first time (about 200 MB, once). Your data is kept between restarts.

Open the frontend (see `../marketsphere-frontend`) and sign in with a demo account.

| Account | Email | Password |
|---|---|---|
| Customer | `customer@example.com` | `Demo@12345` |
| Seller | `seller@apexelectronics.com` | `Demo@12345` |
| Seller | `seller@luminaliving.com` | `Demo@12345` |
| Admin | `admin@marketsphere.in` | `Demo@12345` |

## Use MongoDB / Atlas instead

In `.env`, set `MONGODB_URI` and restart. The terminal prints `Connected to MongoDB: ...`.

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/marketsphere?retryWrites=true&w=majority
```

- Atlas: create a free cluster, add a database user, and allow your IP under **Network Access**.
- Your own MongoDB must run as a **replica set** (checkout uses transactions). For a single
  computer: start `mongod --replSet rs0`, then run `rs.initiate()` once in `mongosh`.
- If the connection fails, the API stops with a message. It never silently falls back to local data.
- Local data and MongoDB data are separate; switching does not copy anything.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-restart |
| `npm run build` / `npm start` | Production build, then run it |
| `npm test` | Unit tests (starts a temporary database by itself) |
| `npm run smoke` | Checks the running API end to end (73 checks: login, checkout, payments, stock, refunds, seller and admin tools, access control) |
| `npm run db:reset` | Erase everything and reload the demo data (asks for `--yes` on a real MongoDB) |
| `npm run create-admin -- you@company.com "Name"` | Create the first admin (use this in production) |
| `npm run lint` | Type check |

## Going live

1. `NODE_ENV=production`, a real `MONGODB_URI`, and `JWT_ACCESS_SECRET` (32+ random characters).
2. Demo data is **not** created in production. Run `npm run create-admin`.
3. **Payments:** the built-in provider is a sandbox, and the browser itself reports "payment
   succeeded". In production the API therefore refuses to capture payments (error
   `PAYMENTS_NOT_CONFIGURED`) until you connect a real gateway such as Razorpay. Do not take real
   orders before that. (`ALLOW_SANDBOX_PAYMENTS=true` re-enables the sandbox for a demo server.)
4. Set `CORS_ORIGINS` to your website address and `TRUST_PROXY=1` behind a proxy or load balancer.
5. A Dockerfile is included.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Could not find or download MongoDB for local mode` | Install MongoDB Community Server, or use Atlas (`MONGODB_URI`), or set `MONGOD_PATH`. |
| `Port 27018 is in use` | Set `LOCAL_MONGO_PORT` to a free port in `.env`. |
| `Failed to connect to MongoDB` with Atlas | Check the password, and that your IP is allowed under Network Access. |
| Everyone is logged out after a restart | Only happens if `JWT_ACCESS_SECRET` changes. In development it is saved in `data/.dev-jwt-secret`. |
