import express, { Express } from 'express';

import { MODE, PORT, URL } from './config/config';

import { init as initDb } from './db';
import { usageCap } from './middleware/usageCap';         // ← NEW

import * as AssetMiddleware from './middleware/asset';
import * as CronMiddleware from './middleware/cron';
import * as ErrorMiddleware from './middleware/error';
import * as LogMiddleware from './middleware/log';
import * as PostMiddleware from './middleware/post';
import * as SecurityMiddleware from './middleware/security';

import * as PDFController from './controller/pdf';
import * as NotFoundController from './controller/not-found';

if (require.main === module) {
  init();
}

async function init(): Promise<Express> {
  const app = express();

  app.use(SecurityMiddleware.app);
  app.use(PostMiddleware.app);
  app.use(AssetMiddleware.app);
  LogMiddleware.init();

  CronMiddleware.init();

  // ─── free-tier usage cap middleware ───────────────────────────────
  app.use('/api/convert', usageCap);    // must be before PDF routes
  // ──────────────────────────────────────────────────────────────────

  app.use(PDFController.router);
  app.use(NotFoundController.router);

  app.use(ErrorMiddleware.handle);

  initDb();
  app.listen(PORT);
  console.log(`Server running in ${MODE} mode on port ${PORT} at ${URL}`);

  return app;
}
