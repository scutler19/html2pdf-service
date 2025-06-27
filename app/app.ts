import express, { Express } from 'express';
import bodyParser from 'body-parser';                 // ← NEW

import { MODE, PORT, URL } from './config/config';

import { init as initDb } from './db';
import { usageCap } from './middleware/usageCap';

import * as AssetMiddleware    from './middleware/asset';
import * as CronMiddleware     from './middleware/cron';
import * as ErrorMiddleware    from './middleware/error';
import * as LogMiddleware      from './middleware/log';
import * as PostMiddleware     from './middleware/post';
import * as SecurityMiddleware from './middleware/security';

import * as PDFController       from './controller/pdf';
import * as SubscribeController from './controller/subscribe';
import * as WebhookController   from './controller/webhook';      // ← NEW
import * as NotFoundController  from './controller/not-found';

if (require.main === module) {
  init();
}

async function init(): Promise<Express> {
  const app = express();

  app.use(SecurityMiddleware.app);

  // ─── Stripe webhook (needs raw body) ─────────────────────────────
  app.use(
    '/webhook/stripe',
    bodyParser.raw({ type: 'application/json' }),
    WebhookController.router
  );
  // ────────────────────────────────────────────────────────────────

  app.use(PostMiddleware.app);    // JSON/body parsing starts here
  app.use(AssetMiddleware.app);
  LogMiddleware.init();

  CronMiddleware.init();

  // ─── free-tier usage cap ────────────────────────────────────────
  app.use('/api/convert', usageCap);            // must precede PDF route
  // ────────────────────────────────────────────────────────────────

  app.use(PDFController.router);
  app.use(SubscribeController.router);
  app.use(NotFoundController.router);

  app.use(ErrorMiddleware.handle);

  initDb();
  app.listen(PORT);
  console.log(`Server running in ${MODE} mode on port ${PORT} at ${URL}`);

  return app;
}
