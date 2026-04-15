// app/middleware/billingGuard.ts
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { BILLING_BYPASS_LOCALS_KEY } from './apiKeyGuard';

/**
 * Validates API key exists in accounts table, then blocks requests whose subscription is paused (payment failure).
 * Expects API key in the "X-API-KEY" header.
 */
export async function billingGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.header('X-API-KEY');
    if (!apiKey) {
      console.warn("Blocked convert (invalid key):", req.ip);
      return res.status(401).json({ error: 'invalid_api_key' });
    }

    // Env-approved keys are allowed to skip account/subscription DB checks (local/dev flow).
    if (res.locals[BILLING_BYPASS_LOCALS_KEY] === true) {
      return next();
    }

    // Bypass all checks for demo key
    if (apiKey === 'demo-unlimited-key-2024') {
      return next();
    }

    // First, validate the API key exists in accounts table
    const accountResult = await pool.query(
      'SELECT api_key FROM accounts WHERE api_key = $1',
      [apiKey]
    );

    if (accountResult.rows.length === 0) {
      console.warn("Blocked convert (invalid key):", req.ip);
      return res.status(401).json({ error: 'invalid_api_key' });
    }

    // Then check subscription status
    const { rows } = await pool.query(
      'SELECT paused FROM subscriptions WHERE api_key = $1',
      [apiKey]
    );

    if (rows.length && rows[0].paused) {
      return res
        .status(402)                       // Payment Required
        .json({ error: 'Subscription payment failed. Update your card in the billing portal.' });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
