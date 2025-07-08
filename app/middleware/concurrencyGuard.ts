/* middleware/concurrencyGuard.ts */
import { NextFunction, Request, Response } from 'express';

/** max parallel conversions – default 4, overridable via env  */
const MAX_PARALLEL = parseInt(process.env.CONVERT_CONCURRENCY || '4', 10);

/** shared limiter – one per process */
let limit: any = null;

// Initialize the limiter asynchronously
async function getLimiter() {
  if (!limit) {
    const pLimit = (await import('p-limit')).default;
    limit = pLimit(MAX_PARALLEL);
  }
  return limit;
}

/**
 * Middleware to limit concurrent PDF conversions.
 * Only allows MAX_PARALLEL conversions to run simultaneously.
 */
export async function concurrencyGuard(req: Request, res: Response, next: NextFunction) {
  // Only apply to PDF conversion requests
  if (req.path === '/api/convert' && (req.method === 'GET' || req.method === 'POST')) {
    const limiter = await getLimiter();
    limiter(() => {
      // Continue to the next middleware/route handler
      return Promise.resolve(next());
    }).catch((error) => {
      console.error('Concurrency guard error:', error);
      return next(error);
    });
  } else {
    // For non-PDF requests, just continue
    next();
  }
}
