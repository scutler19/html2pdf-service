// app/controller/signup.ts
import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import crypto from 'node:crypto';

export const router = Router();

/**
 * POST /api/signup
 * Returns: { apiKey: string, pages_per_month: 50 }
 */
router.post('/api/signup', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 32-char, URL-safe random key
    const apiKey = crypto.randomBytes(24).toString('base64url');

    await pool.query(
      `INSERT INTO api_keys (api_key) VALUES ($1)`,
      [apiKey],
    );

    return res.status(201).json({ apiKey, pages_per_month: 50 });
  } catch (err) {
    next(err);
  }
});
