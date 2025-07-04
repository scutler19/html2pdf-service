/* app.ts */
import express, { Express } from 'express';
import bodyParser from 'body-parser';

import { MODE, PORT, URL } from './config/config';
import { init as initDb }   from './db';

/* middleware */
import { usageCap       } from './middleware/usageCap';
import { billingGuard   } from './middleware/billingGuard';
import { concurrencyGuard } from './middleware/concurrencyGuard';  // ← use existing file

import * as AssetMiddleware     from './middleware/asset';
import * as CronMiddleware      from './middleware/cron';
import * as ErrorMiddleware     from './middleware/error';
import * as LogMiddleware       from './middleware/log';
import * as PostMiddleware      from './middleware/post';
import * as SecurityMiddleware  from './middleware/security';

/* controllers */
import * as PDFController       from './controller/pdf';
import * as SubscribeController from './controller/subscribe';
import * as BillingController   from './controller/billing';
import * as SignupController    from './controller/signup';
import * as WebhookController   from './controller/webhook';
import * as NotFoundController  from './controller/not-found';

if (require.main === module) void init();

async function init(): Promise<Express> {
  const app = express();

  /* security headers, rate-limit headers, etc. */
  app.use(SecurityMiddleware.app);

  /* Stripe webhook (raw body needed for signature) */
  app.use(
    '/webhook/stripe',
    bodyParser.raw({ type: 'application/json' }),
    WebhookController.router,
  );

  /* JSON / URL-encoded parsers, static assets, logging */
  app.use(PostMiddleware.app);
  app.use(AssetMiddleware.app);
  LogMiddleware.init();

  /* background jobs */
  CronMiddleware.init();

  /* ── guards on /api/convert ───────────────────────────── */
  app.use('/api/convert', concurrencyGuard); // NEW – limit parallel renders
  app.use('/api/convert', billingGuard);     // block paused/unpaid subs
  app.use('/api/convert', usageCap);         // 50-page free cap
  /* ------------------------------------------------------ */

  /* routes */
  app.use(PDFController.router);
  app.use(SubscribeController.router);
  app.use(SignupController.router);
  app.use(BillingController.router);
  app.use(NotFoundController.router);

  /* global error handler */
  app.use(ErrorMiddleware.handle);

  initDb();
  app.listen(PORT, () => {
    console.log(`Server running in ${MODE} mode on ${URL} (port ${PORT})`);
  });

  return app;
}
