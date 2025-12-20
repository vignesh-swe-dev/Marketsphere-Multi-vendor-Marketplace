/**
 * Builds the Express application (no listen). server.ts starts it; tests can import it.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { apiRouter } from './api.ts';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // Set TRUST_PROXY=1 when running behind nginx / a load balancer so req.ip is the real client IP.
  if (process.env.TRUST_PROXY) {
    const v = process.env.TRUST_PROXY;
    app.set('trust proxy', /^\d+$/.test(v) ? Number(v) : v);
  }

  // The frontend is a separate project. Only the origins listed in CORS_ORIGINS may call this API
  // from a browser (comma separated). Requests without an Origin header (curl, same-origin proxy) pass.
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false); // no CORS headers => the browser blocks it
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  // Remove MongoDB operators ($ne, $gt ...) from request input so users cannot rewrite database queries
  app.use(mongoSanitize());

  // Request logging
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api/v1')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // REST API
  app.use('/api/v1', apiRouter);

  // JSON 404 for anything else (this project serves the API only)
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Central error handler: never leak internals in production
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[ERROR]', err);
    const isProd = process.env.NODE_ENV === 'production';
    res.status(err?.status || 500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: isProd ? 'Something went wrong' : String(err?.message || err),
      },
    });
  });

  return app;
}
