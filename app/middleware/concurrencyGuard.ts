/* middleware/concurrencyGuard.ts */
import { NextFunction, Request, Response } from 'express';
import { setConvertFailureType } from './convertObservability';

const DEFAULT_MAX_CONCURRENT = 6;
const configuredLimit = Number.parseInt(process.env.CONVERT_CONCURRENCY ?? '', 10);
const MAX_CONCURRENT =
  Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_MAX_CONCURRENT;

/** Shared in-memory counter, one per process. */
let activeConversions = 0;

/**
 * Enforce a hard in-process concurrency cap for conversion requests.
 * This middleware is mounted on /api/convert in app.ts.
 */
export function concurrencyGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'POST') {
    next();
    return;
  }

  if (activeConversions >= MAX_CONCURRENT) {
    setConvertFailureType(res, 'concurrency');
    res.status(429).json({ error: 'Too many concurrent requests' });
    return;
  }

  activeConversions += 1;
  const routePath = `${req.baseUrl}${req.path}`;
  console.log(
    `[concurrencyGuard] start method=${req.method} path=${routePath} active=${activeConversions}/${MAX_CONCURRENT}`,
  );

  let released = false;
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    activeConversions = Math.max(0, activeConversions - 1);
    console.log(
      `[concurrencyGuard] finish method=${req.method} path=${routePath} active=${activeConversions}/${MAX_CONCURRENT}`,
    );
  };

  res.once('finish', release);
  res.once('close', release);
  req.once('aborted', release);

  try {
    next();
  } catch (error) {
    release();
    throw error;
  }
}
