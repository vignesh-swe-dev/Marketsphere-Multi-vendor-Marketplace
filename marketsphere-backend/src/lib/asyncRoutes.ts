import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';

/**
 * Express 4 does not catch errors thrown inside async route handlers: an unhandled rejection can crash
 * the whole server on one bad request. This wraps every handler on a router so such errors are passed
 * to the central error handler in app.ts (which answers with a JSON 500) and the server keeps running.
 */
export function makeAsyncSafe(router: Router): Router {
  const wrap = (fn: RequestHandler): RequestHandler =>
    fn.length >= 4
      ? fn // error-handling middleware, leave as is
      : (req: Request, res: Response, next: NextFunction) => {
          try {
            Promise.resolve(fn(req, res, next)).catch(next);
          } catch (err) {
            next(err);
          }
        };

  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'use'] as const) {
    const original = (router as any)[method].bind(router);
    (router as any)[method] = (...args: any[]) =>
      original(...args.map((a) => (typeof a === 'function' ? wrap(a) : Array.isArray(a) ? a.map((f) => (typeof f === 'function' ? wrap(f) : f)) : a)));
  }
  return router;
}
