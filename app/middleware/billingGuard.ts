// app/middleware/billingGuard.ts
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

/**
 * Blocks requests whose subscription is paused (payment failure).
 * Expects API key in the "X-API-KEY" header – same as usageCap.
 */
export async function billingGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.header('X-API-KEY');
    if (!apiKey) return res.status(401).json({ error: 'Missing X-API-KEY header.' });

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
