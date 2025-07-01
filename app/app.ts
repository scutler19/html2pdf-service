/* app.ts */
import express, { Express } from 'express';
import bodyParser from 'body-parser';

import { MODE, PORT, URL } from './config/config';
import { init as initDb }   from './db';

import { usageCap     } from './middleware/usageCap';
import { billingGuard } from './middleware/billingGuard';

import * as AssetMiddleware     from './middleware/asset';
import * as CronMiddleware      from './middleware/cron';
import * as ErrorMiddleware     from './middleware/error';
import * as LogMiddleware       from './middleware/log';
import * as PostMiddleware      from './middleware/post';
import * as SecurityMiddleware  from './middleware/security';

import * as PDFController        from './controller/pdf';
import * as SubscribeController  from './controller/subscribe';
import * as BillingController    from './controller/billing';
import * as SignupController     from './controller/signup';   // ← NEW
import * as WebhookController    from './controller/webhook';
import * as NotFoundController   from './controller/not-found';

if (require.main === module) {
  init();
}

async function init(): Promise<Express> {
  const app = express();

  /* ── security first ─────────────────────────────────────────── */
  app.use(SecurityMiddleware.app);

  /* ── Stripe webhook (needs raw body) ────────────────────────── */
  app.use(
    '/webhook/stripe',
    bodyParser.raw({ type: 'application/json' }),
    WebhookController.router,
  );
  /* ───────────────────────────────────────────────────────────── */

  app.use(PostMiddleware.app);   // JSON / urlencoded parsers
  app.use(AssetMiddleware.app);
  LogMiddleware.init();

  CronMiddleware.init();

  /* ── guards on the convert endpoint ─────────────────────────── */
  app.use('/api/convert', billingGuard); // block if subscription paused
  app.use('/api/convert', usageCap);     // free-tier limit
  /* ───────────────────────────────────────────────────────────── */

  /* ── application routes ─────────────────────────────────────── */
  app.use(PDFController.router);
  app.use(SubscribeController.router);
  app.use(SignupController.router);      // ← NEW
  app.use(BillingController.router);
  app.use(NotFoundController.router);
  /* ───────────────────────────────────────────────────────────── */

  app.use(ErrorMiddleware.handle);

  initDb();
  app.listen(PORT);
  console.log(
    `Server running in ${MODE} mode on port ${PORT} at ${URL}`,
  );

  return app;
}
