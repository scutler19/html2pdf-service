import { NextFunction, Request, Response } from 'express';
import { setConvertFailureType } from './convertObservability';

const DEMO_API_KEY = 'demo-unlimited-key-2024';
export const BILLING_BYPASS_LOCALS_KEY = 'skipBillingValidation';

function parseAllowDemoKeyFlag(raw: string | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() === 'true';
}

function parseValidApiKeys(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }

  const keys = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return new Set(keys);
}

export function apiKeyGuard(req: Request, res: Response, next: NextFunction): Response | void {
  const apiKey = req.header('X-API-KEY');

  if (!apiKey) {
    setConvertFailureType(res, 'auth');
    return res.status(401).json({ error: 'Missing API key' });
  }

  const validApiKeys = parseValidApiKeys(process.env.VALID_API_KEYS);
  if (validApiKeys.has(apiKey)) {
    res.locals[BILLING_BYPASS_LOCALS_KEY] = true;
    return next();
  }

  const allowDemoKey = parseAllowDemoKeyFlag(process.env.ALLOW_DEMO_KEY);
  if (apiKey === DEMO_API_KEY && allowDemoKey) {
    res.locals[BILLING_BYPASS_LOCALS_KEY] = true;
    return next();
  }

  setConvertFailureType(res, 'auth');
  return res.status(403).json({ error: 'Invalid API key' });
}
