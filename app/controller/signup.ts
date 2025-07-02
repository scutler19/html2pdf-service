/* app/controller/signup.ts */
import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import crypto from 'crypto';

export const router = Router();

/** 40-ish character URL-safe key */
function createApiKey(): string {
  return crypto.randomBytes(30).toString('base64url');
}

router.post(
  '/api/signup',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const emailRaw = (req.body?.email ?? '').trim().toLowerCase();

      // simple validation if the user did supply an address
      if (
        emailRaw &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      ) {
        return res
          .status(400)
          .json({ error: 'Please provide a valid email address.' });
      }

      const apiKey = createApiKey();
      const email  = emailRaw || 'anonymous@example.com'; // satisfies NOT NULL

      await pool.query(
        `INSERT INTO accounts (api_key, email)
         VALUES ($1, $2)`,
        [apiKey, email]
      );

      return res.status(201).json({
        apiKey,
        pages_per_month: 50,
      });
    } catch (err) {
      next(err);
    }
  }
);
