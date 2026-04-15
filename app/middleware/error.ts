import { STATUS_CODES } from 'node:http';
import { Request, Response } from 'express';
import {
  classifyConvertErrorType,
  CONVERT_ERROR_TYPE_LOCALS_KEY,
  CONVERT_REQUEST_ID_LOCALS_KEY,
  CONVERT_START_NS_LOCALS_KEY,
} from './convertObservability';

export function handle(error: any, req: Request, res: Response, next: any): any {
  const requestPath = (req.originalUrl ?? req.path ?? '').split('?')[0];
  const isConvertRequest = requestPath.startsWith('/api/convert');

  if (isConvertRequest) {
    const asStatus = (value: unknown): number | undefined => {
      const n =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim() !== ''
            ? Number(value)
            : Number.NaN;
      if (!Number.isInteger(n) || n < 100 || n > 599) {
        return undefined;
      }
      return n;
    };

    const statusFromError = asStatus(error);
    const statusFromMessage = asStatus(error?.message);
    const statusFromField = asStatus(error?.status);
    const rawStatus =
      statusFromError ??
      statusFromMessage ??
      (error?.name === 'TokenExpiredError' ? 401 : undefined) ??
      statusFromField ??
      500;
    const status = rawStatus === 504 ? 504 : rawStatus >= 500 ? 500 : rawStatus;

    const messageFromError =
      typeof error === 'string' && error.trim().length > 0 ? error.trim() : undefined;
    const messageFromField =
      typeof error?.message === 'string' && error.message.trim().length > 0
        ? error.message.trim()
        : undefined;
    const statusText = STATUS_CODES[status];

    let message = messageFromError ?? messageFromField ?? statusText ?? 'Internal server error';
    if (status === 500) {
      message = 'Internal server error';
    }

    const errorType = classifyConvertErrorType(status, messageFromError ?? messageFromField);
    res.locals[CONVERT_ERROR_TYPE_LOCALS_KEY] = errorType;

    const requestId = res.locals[CONVERT_REQUEST_ID_LOCALS_KEY];
    const startNs = res.locals[CONVERT_START_NS_LOCALS_KEY];
    const durationMs =
      typeof startNs === 'bigint'
        ? Number((process.hrtime.bigint() - startNs) / BigInt(1_000_000))
        : undefined;
    console.info(
      JSON.stringify({
        scope: 'convert',
        event: 'request_failure',
        requestId: typeof requestId === 'string' ? requestId : undefined,
        method: req.method,
        path: requestPath,
        status,
        errorType,
        durationMs,
      }),
    );

    if (status === 500) {
      const errorName = typeof error?.name === 'string' ? error.name : undefined;
      console.error(
        JSON.stringify({
          scope: 'convert',
          event: 'request_failure_internal',
          requestId: typeof requestId === 'string' ? requestId : undefined,
          method: req.method,
          path: requestPath,
          status,
          errorType,
          errorName,
        }),
      );
    }

    return res.status(status).json({ error: message });
  }

  if (!isNaN(error)) {
    return res.sendStatus(error);
  }

  if (!isNaN(error.message)) {
    return res.sendStatus(error.message);
  }

  if (error.name === 'TokenExpiredError') {
    return res.sendStatus(401);
  }

  if (error.status) {
    return res.status(error.status).send(error.message);
  }

  res.status(500).send(error);
}
