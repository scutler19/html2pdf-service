// app/controller/webhook.ts
import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { pool } from '../db';
import { getStripe } from '../lib/stripeClient';

/** choose secret by live/test mode */
function chooseSecret(live: boolean): string {
  return live
    ? process.env.STRIPE_WEBHOOK_SECRET!        // live endpoint secret
    : process.env.STRIPE_WEBHOOK_SECRET_TEST!;  // test-mode secret
}

export const router = Router();

/**
 * Stripe webhook endpoint
 * (mounted with express.raw in app.ts)
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).send('Webhook unavailable: STRIPE_KEY not configured');
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    // Stripe adds "Stripe-Livemode: true|false"; CLI omits it.
    const liveHeader = req.headers['stripe-livemode'] as string | undefined;
    const live       = liveHeader === 'true';     // undefined → test
    const secret     = chooseSecret(live);

    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  try {
    switch (event.type) {
      /* ───────────── 1. new checkout → store plan ───────────── */
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!session.subscription || !session.metadata?.api_key) break;

        const apiKey         = session.metadata.api_key;
        const subscriptionId = session.subscription.toString();

        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        });

        const fixedItem = sub.items.data.find(
          (i) => i.price.type === 'recurring' && i.price.unit_amount
        );
        if (!fixedItem) break;

        const planPriceId = fixedItem.price.id;

        await pool.query(
          `INSERT INTO subscriptions (api_key, subscription_id, price_id, paused)
             VALUES ($1, $2, $3, false)
           ON CONFLICT (api_key) DO UPDATE
             SET subscription_id = EXCLUDED.subscription_id,
                 price_id        = EXCLUDED.price_id,
                 paused          = false`,
          [apiKey, subscriptionId, planPriceId]
        );

        console.log(`✅ Linked ${apiKey} → ${subscriptionId}`);
        break;
      }

      /* ───────────── 2. invoice failed → pause ──────────────── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        await pool.query(
          `UPDATE subscriptions
             SET paused = true, updated_at = now()
           WHERE subscription_id = $1`,
          [invoice.subscription.toString()]
        );

        console.log(`⏸️  Paused sub ${invoice.subscription} (payment failed)`);
        break;
      }

      /* ───────────── 3. invoice paid → unpause ─────────────── */
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        await pool.query(
          `UPDATE subscriptions
             SET paused = false, updated_at = now()
           WHERE subscription_id = $1`,
          [invoice.subscription.toString()]
        );

        console.log(`▶️  Unpaused sub ${invoice.subscription} (payment ok)`);
        break;
      }

      /* ───────────── 4. plan change / cancel ────────────────── */
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;

        const fixedItem = sub.items.data.find(
          (i) => i.price.type === 'recurring' && i.price.unit_amount
        );
        if (!fixedItem) break;

        const priceId = fixedItem.price.id;
        const paused  = sub.status !== 'active';

        await pool.query(
          `UPDATE subscriptions
             SET price_id = $1,
                 paused   = $2,
                 updated_at = now()
           WHERE subscription_id = $3`,
          [priceId, paused, sub.id]
        );

        console.log(`🔄 Updated sub ${sub.id} (price → ${priceId}, paused ${paused})`);
        break;
      }

      /* ───────────── 5. subscription deleted → pause ────────── */
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        await pool.query(
          `UPDATE subscriptions
             SET paused = true, updated_at = now()
           WHERE subscription_id = $1`,
          [sub.id]
        );

        console.log(`❌ Subscription ${sub.id} canceled → key paused`);
        break;
      }

      default:
        // ignore other events
        break;
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});
