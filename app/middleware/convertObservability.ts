import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export const CONVERT_REQUEST_ID_LOCALS_KEY = 'convertRequestId';
export const CONVERT_START_NS_LOCALS_KEY = 'convertStartNs';
export const CONVERT_ERROR_TYPE_LOCALS_KEY = 'convertErrorType';
export const CONVERT_BYTES_LOCALS_KEY = 'convertBytes';

export type ConvertErrorType =
  | 'invalid_input'
  | 'blocked_url'
  | 'timeout'
  | 'concurrency'
  | 'auth'
  | 'usage_cap'
  | 'internal'
  | 'unknown';

type ConvertInputMode = 'html' | 'url' | 'unknown';

type ConvertRequestContext = {
  method: string;
  path: string;
  inputMode: ConvertInputMode;
  targetHost?: string;
  captureMode: 'pdf' | 'screenshot_pdf';
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
  viewport?: string;
  hasWaitForSelector: boolean;
  hasHideSelectors: boolean;
  hasRemoveSelectors: boolean;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function unwrap(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.length > 0 ? unwrap(value[0]) : undefined;
  }
  return value;
}

function asOptionalString(value: unknown): string | undefined {
  const v = unwrap(value);
  if (typeof v !== 'string') {
    return undefined;
  }
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asOptionalInteger(value: unknown): number | undefined {
  const v = unwrap(value);
  if (typeof v === 'number' && Number.isInteger(v)) {
    return v;
  }
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') {
      return undefined;
    }
    const parsed = Number(trimmed);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function hasListLikeValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => typeof entry === 'string' && entry.trim().length > 0);
  }
  return false;
}

function asOptionalWaitUntil(
  value: unknown,
): 'load' | 'domcontentloaded' | 'networkidle' | undefined {
  const v = asOptionalString(value);
  if (v === 'load' || v === 'domcontentloaded' || v === 'networkidle') {
    return v;
  }
  return undefined;
}

function asCaptureMode(value: unknown): 'pdf' | 'screenshot_pdf' {
  const v = asOptionalString(value);
  return v === 'screenshot_pdf' ? 'screenshot_pdf' : 'pdf';
}

function asTargetHost(urlValue: unknown): string | undefined {
  const rawUrl = asOptionalString(urlValue);
  if (!rawUrl) {
    return undefined;
  }
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname || undefined;
  } catch {
    return undefined;
  }
}

function buildConvertContext(req: Request): ConvertRequestContext {
  const source = toRecord(req.method === 'GET' ? req.query : req.body);
  const htmlPresent = asOptionalString(source.html) !== undefined;
  const urlPresent = asOptionalString(source.url) !== undefined;
  const inputMode: ConvertInputMode = htmlPresent ? 'html' : urlPresent ? 'url' : 'unknown';

  const viewportWidth = asOptionalInteger(source.viewportWidth);
  const viewportHeight = asOptionalInteger(source.viewportHeight);
  const viewport =
    viewportWidth !== undefined && viewportHeight !== undefined
      ? `${viewportWidth}x${viewportHeight}`
      : undefined;

  return {
    method: req.method,
    path: (req.originalUrl ?? req.path ?? '').split('?')[0],
    inputMode,
    targetHost: inputMode === 'url' ? asTargetHost(source.url) : undefined,
    captureMode: asCaptureMode(source.captureMode),
    waitUntil: asOptionalWaitUntil(source.waitUntil),
    timeout: asOptionalInteger(source.timeout),
    viewport,
    hasWaitForSelector: asOptionalString(source.waitForSelector) !== undefined,
    hasHideSelectors: hasListLikeValue(source.hideSelectors),
    hasRemoveSelectors: hasListLikeValue(source.removeSelectors),
  };
}

function toDurationMs(startNs: bigint): number {
  const elapsedNs = process.hrtime.bigint() - startNs;
  return Number(elapsedNs / BigInt(1_000_000));
}

function logConvertEvent(payload: Record<string, unknown>): void {
  console.info(JSON.stringify({ scope: 'convert', ...payload }));
}

export function classifyConvertErrorType(status: number, message: string | undefined): ConvertErrorType {
  const normalized = (message ?? '').toLowerCase();

  if (normalized.includes('invalid input')) {
    return 'invalid_input';
  }
  if (normalized.includes('url not allowed')) {
    return 'blocked_url';
  }
  if (normalized.includes('timed out')) {
    return 'timeout';
  }
  if (normalized.includes('too many concurrent')) {
    return 'concurrency';
  }
  if (
    normalized.includes('daily free limit reached') ||
    normalized.includes('monthly free limit reached')
  ) {
    return 'usage_cap';
  }
  if (
    normalized.includes('missing api key') ||
    normalized.includes('invalid api key') ||
    normalized.includes('invalid_api_key') ||
    normalized.includes('subscription payment failed')
  ) {
    return 'auth';
  }

  if (status === 400) {
    return 'invalid_input';
  }
  if (status === 504) {
    return 'timeout';
  }
  if (status === 401 || status === 402 || status === 403) {
    return 'auth';
  }
  if (status === 429) {
    return 'usage_cap';
  }
  if (status >= 500) {
    return 'internal';
  }
  return 'unknown';
}

export function setConvertFailureType(res: Response, errorType: ConvertErrorType): void {
  res.locals[CONVERT_ERROR_TYPE_LOCALS_KEY] = errorType;
}

export function setConvertBytes(res: Response, bytes: number): void {
  res.locals[CONVERT_BYTES_LOCALS_KEY] = bytes;
}

export function convertObservability(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'POST') {
    next();
    return;
  }

  const context = buildConvertContext(req);
  const incomingRequestId = req.header('X-Request-Id');
  const requestId =
    typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
      ? incomingRequestId.trim().slice(0, 128)
      : randomUUID();
  const startNs = process.hrtime.bigint();

  res.locals[CONVERT_REQUEST_ID_LOCALS_KEY] = requestId;
  res.locals[CONVERT_START_NS_LOCALS_KEY] = startNs;

  logConvertEvent({
    event: 'request_start',
    requestId,
    method: context.method,
    path: context.path,
    inputMode: context.inputMode,
    targetHost: context.targetHost,
    captureMode: context.captureMode,
    waitUntil: context.waitUntil,
    timeout: context.timeout,
    viewport: context.viewport,
    hasWaitForSelector: context.hasWaitForSelector,
    hasHideSelectors: context.hasHideSelectors,
    hasRemoveSelectors: context.hasRemoveSelectors,
  });

  res.once('finish', () => {
    const status = res.statusCode;
    const durationMs = toDurationMs(startNs);
    const outcome = status >= 200 && status < 400 ? 'success' : 'failure';
    const bytesValue = res.locals[CONVERT_BYTES_LOCALS_KEY];
    const bytes = typeof bytesValue === 'number' ? bytesValue : undefined;

    let errorType: ConvertErrorType | undefined;
    if (outcome === 'failure') {
      const fromLocals = res.locals[CONVERT_ERROR_TYPE_LOCALS_KEY];
      if (typeof fromLocals === 'string') {
        errorType = fromLocals as ConvertErrorType;
      } else {
        errorType = classifyConvertErrorType(status, undefined);
      }
    }

    logConvertEvent({
      event: 'request_finish',
      requestId,
      method: context.method,
      path: context.path,
      inputMode: context.inputMode,
      targetHost: context.targetHost,
      captureMode: context.captureMode,
      waitUntil: context.waitUntil,
      timeout: context.timeout,
      viewport: context.viewport,
      hasWaitForSelector: context.hasWaitForSelector,
      hasHideSelectors: context.hasHideSelectors,
      hasRemoveSelectors: context.hasRemoveSelectors,
      status,
      outcome,
      errorType,
      durationMs,
      bytes,
    });
  });

  next();
}
