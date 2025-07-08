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

  /* health check endpoint - add before any middleware that might block it */
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: PORT, timestamp: new Date().toISOString() });
  });

  /* root endpoint for debugging */
  app.get('/', (req, res) => {
    res.json({ 
      message: 'HTML2PDF Service is running',
      port: PORT,
      timestamp: new Date().toISOString(),
      endpoints: ['/health', '/api/convert', '/api/signup']
    });
  });

  /* JSON / URL-encoded parsers, static assets, logging */
  app.use(PostMiddleware.app);
  app.use(AssetMiddleware.app);
  LogMiddleware.init();

  /* background jobs */
  CronMiddleware.init();

  /* ── guards on /api/convert ───────────────────────────── */
  // app.use('/api/convert', concurrencyGuard); // TEMPORARILY DISABLED – causing issues
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

  try {
    await initDb();
    console.log('✅ Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      console.log("Server booted 🏃");
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }

  return app;
}
