// app/middleware/usageCap.ts
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

// free-tier limits
const MAX_PDFS_MONTH = 50;
const MAX_PDFS_DAY   = 5;

export async function usageCap(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) return res.status(401).send('API key required');

  try {
    const { rows } = await pool.query(
      `
      SELECT
        SUM(CASE WHEN created_at >= date_trunc('day',   now()) THEN pages ELSE 0 END) AS pages_day,
        SUM(CASE WHEN created_at >= date_trunc('month', now()) THEN pages ELSE 0 END) AS pages_month
      FROM page_events
      WHERE api_key = $1
      `,
      [apiKey]
    );

    const { pages_day, pages_month } = rows[0];

    if (pages_day   >= MAX_PDFS_DAY)   return res.status(429).send('Daily free limit reached');
    if (pages_month >= MAX_PDFS_MONTH) return res.status(429).send('Monthly free limit reached');

    return next();
  } catch (err) {
    console.error('usageCap error', err);
    return res.status(500).send('Usage check failed');
  }
}
