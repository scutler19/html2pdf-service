import path from 'node:path';
import fs from 'node:fs';
import { pool } from '../db';

import { Request, Response, Router } from 'express';
import * as PDF from '../model/pdf';

export const router = Router();

// ──────────────── GET /api/convert ─────────────────────────────────────
router.get('/api/convert', async (req: Request, res: Response, next: any) => {
  const {
    html,
    headerTemplate,
    footerTemplate,
    style,
    format,
    landscape,
    width,
    height,
    filename,
    marginTop,
    marginLeft,
    marginRight,
    marginBottom,
  } = req.query as any;

  const margin = { top: marginTop, left: marginLeft, right: marginRight, bottom: marginBottom };

  const options = {
    content: html,
    headerTemplate,
    footerTemplate,
    style,
    format,
    landscape: landscape === 'true',
    width,
    height,
    margin,
    filename,
  };

  try {
    const data = await PDF.convertHtmlContentToPDF(options);
    const localPath = path.join(process.cwd(), 'public', 'pdf', path.basename(data));

    // stream the PDF
    res.download(localPath);

    // ─── usage metering ─────────────────────────────────────────────────
    try {
      const stats = fs.statSync(localPath);
      const pages = 1;                    // replace with real page count if available
      const bytes = stats.size;

      await pool.query(
        'INSERT INTO page_events (api_key, pages, bytes) VALUES ($1, $2, $3)',
        [req.headers['x-api-key'], pages, bytes]
      );
      console.log(`📊 logged ${bytes} B for ${req.headers['x-api-key']}`);
    } catch (err) {
      console.error('metering insert failed', err);
    }
    // ────────────────────────────────────────────────────────────────────
  } catch (error) {
    return next(error);
  }
});

// ──────────────── POST /api/convert ────────────────────────────────────
router.post('/api/convert', async (req: Request, res: Response, next: any) => {
  const {
    html,
    headerTemplate,
    footerTemplate,
    style,
    format,
    landscape,
    width,
    height,
    filename,
    marginTop,
    marginLeft,
    marginRight,
    marginBottom,
  } = req.body;

  const margin = { top: marginTop, left: marginLeft, right: marginRight, bottom: marginBottom };

  const options = {
    content: html,
    headerTemplate,
    footerTemplate,
    style,
    format,
    landscape: landscape === 'true',
    width,
    height,
    margin,
    filename,
  };

  try {
    const data = await PDF.convertHtmlContentToPDF(options);
    const localPath = path.join(process.cwd(), 'public', 'pdf', path.basename(data));

    // stream the PDF
    res.download(localPath);

    // ─── usage metering ─────────────────────────────────────────────────
    try {
      const stats = fs.statSync(localPath);
      const pages = 1;
      const bytes = stats.size;

      await pool.query(
        'INSERT INTO page_events (api_key, pages, bytes) VALUES ($1, $2, $3)',
        [req.headers['x-api-key'], pages, bytes]
      );
      console.log(`📊 logged ${bytes} B for ${req.headers['x-api-key']}`);
    } catch (err) {
      console.error('metering insert failed', err);
    }
    // ────────────────────────────────────────────────────────────────────
  } catch (error) {
    return next(error);
  }
});
