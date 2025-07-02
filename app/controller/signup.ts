/* app/controller/signup.ts */
import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import crypto from 'crypto';

export const router = Router();

function createApiKey(): string {
  return crypto.randomBytes(30).toString('base64url'); // ≈40 chars
}

router.post('/api/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();

    // very light e-mail sanity check
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const apiKey = createApiKey();

    const { rows } = await pool.query(
      `INSERT INTO accounts (api_key, email)
         VALUES ($1, $2)
       ON CONFLICT (api_key) DO NOTHING
       RETURNING api_key`,
      [apiKey, email || null]
    );

    // rows[0] is present unless a (rare) key collision happened
    const key = rows.length ? rows[0].api_key : apiKey;

    res.json({ apiKey: key, pages_per_month: 50 });
  } catch (err) {
    next(err);
  }
});
