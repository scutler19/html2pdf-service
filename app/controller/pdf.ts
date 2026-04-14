import path from 'node:path';
import fs from 'node:fs';
import { pool } from '../db';

import { Request, Response, Router } from 'express';
import * as PDF from '../model/pdf';

export const router = Router();

class BadInputError extends Error {
  constructor(public readonly field: string) {
    super(`Invalid input: ${field}`);
    this.name = 'BadInputError';
  }
}

function unwrap(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.length > 0 ? unwrap(value[0]) : undefined;
  }
  return value;
}

function asOptionalString(value: unknown): string | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v === 'string') {
    return v.length === 0 ? undefined : v;
  }
  return undefined;
}

function asRequiredString(value: unknown, fieldName: string): string {
  const v = unwrap(value);
  if (typeof v === 'string' && v.length > 0) {
    return v;
  }
  throw new BadInputError(fieldName);
}

function asBoolean(value: unknown): boolean | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  if (v === true) {
    return true;
  }
  if (v === false) {
    return false;
  }
  if (typeof v === 'string') {
    if (v === 'true') {
      return true;
    }
    if (v === 'false') {
      return false;
    }
  }
  return undefined;
}

/** Optional `printBackground`; defaults to `true`; invalid values throw. */
function asPrintBackground(value: unknown): boolean {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return true;
  }
  if (v === true) {
    return true;
  }
  if (v === false) {
    return false;
  }
  if (typeof v === 'string') {
    if (v === 'true') {
      return true;
    }
    if (v === 'false') {
      return false;
    }
  }
  throw new BadInputError('printBackground');
}

function asOptionalNumber(value: unknown): number | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) {
      throw new BadInputError('delayMs');
    }
    return Math.min(Math.floor(v), PDF.DELAY_MS_MAX);
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') {
      return undefined;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) {
      throw new BadInputError('delayMs');
    }
    return Math.min(Math.floor(n), PDF.DELAY_MS_MAX);
  }
  throw new BadInputError('delayMs');
}

function asOptionalDimension(value: unknown, fieldName: string): string | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(v);
  }
  if (typeof v === 'string' && v.length > 0) {
    return v;
  }
  throw new BadInputError(fieldName);
}

function asOptionalMarginSide(value: unknown, fieldName: string): string | number | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === 'string' && v.length > 0) {
    return v;
  }
  throw new BadInputError(fieldName);
}

function toParamRecord(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input)) {
    out[key] = val;
  }
  return out;
}

function parsePdfConvertInput(source: Record<string, unknown>): PDF.ConvertHtmlToPdfOptions {
  const content = asRequiredString(source.html, 'html');

  const headerTemplate = asOptionalString(source.headerTemplate);
  const footerTemplate = asOptionalString(source.footerTemplate);
  const style = asOptionalString(source.style);
  const format = asOptionalString(source.format);
  const filename = asOptionalString(source.filename);

  const landscape = asBoolean(source.landscape) ?? false;

  const printBackground = asPrintBackground(source.printBackground);

  const delayMs = asOptionalNumber(source.delayMs);

  const width = asOptionalDimension(source.width, 'width');
  const height = asOptionalDimension(source.height, 'height');

  const marginTop = asOptionalMarginSide(source.marginTop, 'marginTop');
  const marginLeft = asOptionalMarginSide(source.marginLeft, 'marginLeft');
  const marginRight = asOptionalMarginSide(source.marginRight, 'marginRight');
  const marginBottom = asOptionalMarginSide(source.marginBottom, 'marginBottom');

  const margin: NonNullable<PDF.ConvertHtmlToPdfOptions['margin']> = {};
  if (marginTop !== undefined) {
    margin.top = marginTop;
  }
  if (marginLeft !== undefined) {
    margin.left = marginLeft;
  }
  if (marginRight !== undefined) {
    margin.right = marginRight;
  }
  if (marginBottom !== undefined) {
    margin.bottom = marginBottom;
  }

  const options: PDF.ConvertHtmlToPdfOptions = {
    content,
    landscape,
    printBackground,
  };

  if (headerTemplate !== undefined) {
    options.headerTemplate = headerTemplate;
  }
  if (footerTemplate !== undefined) {
    options.footerTemplate = footerTemplate;
  }
  if (style !== undefined) {
    options.style = style;
  }
  if (format !== undefined) {
    options.format = format;
  }
  if (filename !== undefined) {
    options.filename = filename;
  }
  if (delayMs !== undefined) {
    options.delayMs = delayMs;
  }
  if (width !== undefined) {
    options.width = width;
  }
  if (height !== undefined) {
    options.height = height;
  }
  if (Object.keys(margin).length > 0) {
    options.margin = margin;
  }

  return options;
}

async function respondWithPdf(res: Response, next: (err: unknown) => void, options: PDF.ConvertHtmlToPdfOptions, apiKey: string | string[] | undefined): Promise<void> {
  try {
    const data = await PDF.convertHtmlContentToPDF(options);
    const localPath = path.join(process.cwd(), 'public', 'pdf', path.basename(data));

    res.download(localPath);

    try {
      const stats = fs.statSync(localPath);
      const pages = 1;
      const bytes = stats.size;

      await pool.query(
        'INSERT INTO page_events (api_key, pages, bytes) VALUES ($1, $2, $3)',
        [apiKey, pages, bytes]
      );
      console.log(`📊 logged ${bytes} B for ${apiKey}`);
    } catch (err) {
      console.error('metering insert failed', err);
    }
  } catch (error) {
    next(error);
  }
}

// ──────────────── GET /api/convert ─────────────────────────────────────
router.get('/api/convert', async (req: Request, res: Response, next: any) => {
  let options: PDF.ConvertHtmlToPdfOptions;
  try {
    options = parsePdfConvertInput(toParamRecord(req.query));
  } catch (err) {
    if (err instanceof BadInputError) {
      return res.status(400).json({ error: `Invalid input: ${err.field}` });
    }
    return next(err);
  }

  return respondWithPdf(res, next, options, req.headers['x-api-key']);
});

// ──────────────── POST /api/convert ────────────────────────────────────
router.post('/api/convert', async (req: Request, res: Response, next: any) => {
  let options: PDF.ConvertHtmlToPdfOptions;
  try {
    options = parsePdfConvertInput(toParamRecord(req.body));
  } catch (err) {
    if (err instanceof BadInputError) {
      return res.status(400).json({ error: `Invalid input: ${err.field}` });
    }
    return next(err);
  }

  return respondWithPdf(res, next, options, req.headers['x-api-key']);
});
