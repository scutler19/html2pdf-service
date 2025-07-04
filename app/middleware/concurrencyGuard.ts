/* middleware/concurrencyGuard.ts */
import { NextFunction, Request, Response } from 'express';
import pLimit from 'p-limit';

/** max parallel conversions – default 4, overridable via env  */
const MAX_PARALLEL = parseInt(process.env.CONVERT_CONCURRENCY || '4', 10);

/** shared limiter – one per process */
const limit = pLimit(MAX_PARALLEL);

/**
 * Wrap the heavy /convert handler so only `MAX_PARALLEL`
 * promises may execute concurrently.
 *
 * Usage (example in step 4):
 *   app.post('/api/convert', concurrencyGuard(pdfHandler))
 */
export function concurrencyGuard(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) =>
    limit(() => handler(req, res, next)).catch(next);
}
