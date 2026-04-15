import path from 'node:path';
import fs from 'node:fs';
import { pool } from '../db';

import { Request, Response, Router } from 'express';
import { assertSafeUrl } from '../lib/safeUrl';
import * as PDF from '../model/pdf';

export const router = Router();

class BadInputError extends Error {
  constructor(public readonly field: string) {
    super(`Invalid input: ${field}`);
    this.name = 'BadInputError';
  }
}

/** `instanceof` is unreliable for `Error` subclasses in some TS/Node setups; use a structural check. */
function isBadInputError(err: unknown): err is BadInputError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as Error).name === 'BadInputError' &&
    typeof (err as BadInputError).field === 'string'
  );
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

/** Optional `captureMode`; omitted/empty → `pdf`; only `pdf` | `screenshot_pdf` accepted (case-sensitive). */
function asOptionalCaptureMode(value: unknown): 'pdf' | 'screenshot_pdf' {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return 'pdf';
  }
  if (v === 'pdf' || v === 'screenshot_pdf') {
    return v;
  }
  throw new BadInputError('captureMode');
}

/** Optional `mediaType`; omitted/empty → default print in renderer; only `print` | `screen` accepted (case-sensitive). */
function asOptionalMediaType(value: unknown): 'print' | 'screen' | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  if (v === 'print' || v === 'screen') {
    return v;
  }
  throw new BadInputError('mediaType');
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

function asOptionalScale(value: unknown): number | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  let n: number;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') {
      return undefined;
    }
    n = Number(t);
  } else {
    throw new BadInputError('scale');
  }
  if (!Number.isFinite(n) || n < 0.1 || n > 2) {
    throw new BadInputError('scale');
  }
  return n;
}

function asOptionalWaitForSelector(value: unknown): string | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v !== 'string') {
    throw new BadInputError('waitForSelector');
  }
  const t = v.trim();
  if (t === '') {
    throw new BadInputError('waitForSelector');
  }
  return t;
}

function asOptionalHideSelectors(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') {
      throw new BadInputError('hideSelectors');
    }
    return [t];
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string') {
        throw new BadInputError('hideSelectors');
      }
      const t = item.trim();
      if (t === '') {
        throw new BadInputError('hideSelectors');
      }
      out.push(t);
    }
    return out.length > 0 ? out : undefined;
  }
  throw new BadInputError('hideSelectors');
}

const VIEWPORT_MIN = 320;
const VIEWPORT_MAX = 3840;

/** Optional viewport dimension; omitted/empty → undefined. Integers only, in [VIEWPORT_MIN, VIEWPORT_MAX]. */
function asOptionalViewportDimension(value: unknown): number | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  let n: number;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') {
      return undefined;
    }
    n = Number(t);
  } else {
    throw new BadInputError('viewport');
  }
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < VIEWPORT_MIN || n > VIEWPORT_MAX) {
    throw new BadInputError('viewport');
  }
  return n;
}

/** Optional job timeout (ms); strict integer in [TIMEOUT_MS_MIN, TIMEOUT_MS_MAX]. */
function asOptionalTimeoutMs(value: unknown): number | undefined {
  const v = unwrap(value);
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  let n: number;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') {
      return undefined;
    }
    n = Number(t);
  } else {
    throw new BadInputError('timeout');
  }
  if (
    !Number.isFinite(n) ||
    !Number.isInteger(n) ||
    n < PDF.TIMEOUT_MS_MIN ||
    n > PDF.TIMEOUT_MS_MAX
  ) {
    throw new BadInputError('timeout');
  }
  return n;
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

function assertValidHttpOrHttpsUrl(urlString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new BadInputError('url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadInputError('url');
  }
  if (parsed.hostname === '') {
    throw new BadInputError('url');
  }
}

function parsePdfConvertInput(source: Record<string, unknown>): PDF.ConvertHtmlToPdfOptions {
  const htmlPresent = asOptionalString(source.html);
  const urlPresent = asOptionalString(source.url);

  if ((htmlPresent !== undefined) === (urlPresent !== undefined)) {
    throw new BadInputError('html_or_url');
  }

  const headerTemplate = asOptionalString(source.headerTemplate);
  const footerTemplate = asOptionalString(source.footerTemplate);
  const style = asOptionalString(source.style);
  const format = asOptionalString(source.format);
  const filename = asOptionalString(source.filename);

  const landscape = asBoolean(source.landscape) ?? false;

  const preferCSSPageSize = asBoolean(source.preferCSSPageSize) ?? false;

  const printBackground = asPrintBackground(source.printBackground);

  const delayMs = asOptionalNumber(source.delayMs);

  const scale = asOptionalScale(source.scale);

  const timeout = asOptionalTimeoutMs(source.timeout);

  const hideSelectors = asOptionalHideSelectors(source.hideSelectors);

  const waitForSelector = asOptionalWaitForSelector(source.waitForSelector);

  const mediaType = asOptionalMediaType(source.mediaType);

  const captureMode = asOptionalCaptureMode(source.captureMode);

  const viewportWidth = asOptionalViewportDimension(source.viewportWidth);
  const viewportHeight = asOptionalViewportDimension(source.viewportHeight);
  if ((viewportWidth === undefined) !== (viewportHeight === undefined)) {
    throw new BadInputError('viewport');
  }

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
    landscape,
    preferCSSPageSize,
    printBackground,
  };

  if (htmlPresent !== undefined) {
    options.content = asRequiredString(source.html, 'html');
  } else {
    assertValidHttpOrHttpsUrl(urlPresent as string);
    options.url = urlPresent as string;
  }

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
  if (scale !== undefined) {
    options.scale = scale;
  }
  if (timeout !== undefined) {
    options.timeout = timeout;
  }
  options.captureMode = captureMode;
  if (hideSelectors !== undefined) {
    options.hideSelectors = hideSelectors;
  }
  if (waitForSelector !== undefined) {
    options.waitForSelector = waitForSelector;
  }
  if (mediaType !== undefined) {
    options.mediaType = mediaType;
  }
  if (viewportWidth !== undefined && viewportHeight !== undefined) {
    options.viewportWidth = viewportWidth;
    options.viewportHeight = viewportHeight;
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
    if (options.url) {
      await assertSafeUrl(options.url);
    }
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
    if (isBadInputError(err)) {
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
    if (isBadInputError(err)) {
      return res.status(400).json({ error: `Invalid input: ${err.field}` });
    }
    return next(err);
  }

  return respondWithPdf(res, next, options, req.headers['x-api-key']);
});
