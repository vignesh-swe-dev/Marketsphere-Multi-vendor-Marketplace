# MarketSphere Frontend

Web app for the MarketSphere multi-vendor marketplace: React 19, Vite, Tailwind CSS v4, Motion.
Storefront, product pages, cart and multi-seller checkout, customer orders with tracking,
seller dashboard and admin console.

This is a **standalone project**. The API lives in its own folder, `marketsphere-backend`,
and must be running separately.

## Requirements
- Node.js 20+ (22 recommended)
- The backend running on `http://localhost:4000` (see its README)

## Quick start
```bash
npm install
npm run dev          # http://localhost:5173
```
In development the Vite server **proxies `/api` to the backend**, so the browser only talks to one
origin (no CORS setup needed).

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (port 5173) |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally (also proxies `/api`) |
| `npm run lint` | Type-check |
| `npm test` | Unit tests |

## Configuration
Copy `.env.example` to `.env.local` only if you need to change something.
| Variable | Default | Notes |
|---|---|---|
| `VITE_DEV_PROXY_TARGET` | `http://localhost:4000` | Backend URL for the dev/preview proxy |
| `VITE_API_BASE` | `/api/v1` | API base the browser uses. Change only if the API is on another domain (then add this site to the backend's `CORS_ORIGINS`) |

## Demo sign-in
The seeded demo accounts are listed in the backend README. The current sign-in screen is a
**demo persona login** (it does not check a password yet), matching the current backend.

## Docker
```bash
docker build -t marketsphere-frontend .
docker run -p 8080:80 -e BACKEND_URL=http://host.docker.internal:4000 marketsphere-frontend
```
nginx serves the built app and forwards `/api/` to `BACKEND_URL`, so the browser still sees a single origin.
