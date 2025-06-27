// app/controller/webhook.ts
import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { pool } from '../db';

const stripe    = new Stripe(process.env.STRIPE_KEY!, { apiVersion: '2024-04-10' });
const WH_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export const router = Router();

/**
 * Stripe webhook endpoint
 * Mounted with express.raw in app.ts
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WH_SECRET);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (!session.subscription || !session.metadata?.api_key) {
        return res.json({ received: true });
      }

      const apiKey        = session.metadata.api_key;
      const subscriptionId = session.subscription.toString();

      /** Retrieve the subscription to discover the fixed-fee price */
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price'],
      });

      const fixedItem = sub.items.data.find(
        (i) => i.price.type === 'recurring' && i.price.unit_amount
      );
      if (!fixedItem) {
        console.warn('⚠️  No fixed-fee item found on subscription', subscriptionId);
        return res.json({ received: true });
      }

      const planPriceId = fixedItem.price.id;

      await pool.query(
        `INSERT INTO subscriptions (api_key, subscription_id, price_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (api_key) DO UPDATE
         SET subscription_id = EXCLUDED.subscription_id,
             price_id        = EXCLUDED.price_id`,
        [apiKey, subscriptionId, planPriceId]
      );

      console.log(`✅ Linked ${apiKey} → ${subscriptionId}`);
    }

    // Handle more event types (invoice.payment_failed, etc.) as needed

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});
