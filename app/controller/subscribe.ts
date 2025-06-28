// app/controller/subscribe.ts
import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_KEY!, { apiVersion: '2024-04-10' });

/*───────────────────────────────────────────────────────────────────────────
  Price IDs in live and test mode
  (generated earlier in Stripe Dashboard)
───────────────────────────────────────────────────────────────────────────*/
const IS_TEST = process.env.STRIPE_KEY!.startsWith('sk_test');

const PRICES = IS_TEST
  ? {
      STARTER:  'price_1ReqRTC06iB64lkC7K2urHlK', // Starter 2 000 (test)
      PRO:      'price_1ReqRtC06iB64lkCu2FSOxqz', // Pro 12 000 (test)
      OVERAGE:  'price_1ReqT7C06iB64lkCFDfgCqO4', // Overage (test)
    }
  : {
      STARTER:  'price_1RejY7C06iB64lkCRQh26hSB', // Starter 2 000 (live)
      PRO:      'price_1Reja6C06iB64lkCIjaBIBnC', // Pro 12 000 (live)
      OVERAGE:  'price_1RekXIC06iB64lkCURRkHq7Z', // Overage (live)
    };

// success & cancel return to your marketing site (adjust as needed)
const SUCCESS_URL = 'https://fileslap.com/success';
const CANCEL_URL  = 'https://fileslap.com/cancel';

export const router = Router();

/**
 * GET /api/subscribe/:plan?key=YOUR_API_KEY
 * :plan = starter | pro
 * Redirects (303) to Stripe Checkout
 */
router.get(
  '/api/subscribe/:plan',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.query.key as string;
      if (!apiKey) return res.status(400).send('Missing ?key');

      const plan   = req.params.plan;
      const priceId =
        plan === 'starter'
          ? PRICES.STARTER
          : plan === 'pro'
            ? PRICES.PRO
            : null;

      if (!priceId) return res.status(400).send('Plan must be starter or pro');

      /* ────── find-or-create Customer by api_key ────── */
      const { data } = await stripe.customers.search({
        query: `metadata['api_key']:'${apiKey}'`,
        limit: 1,
      });

      const customerId = data.length
        ? data[0].id
        : (
            await stripe.customers.create({
              metadata: { api_key: apiKey },
            })
          ).id;

      /* ────── create Checkout Session ────── */
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [
          { price: priceId,          quantity: 1 }, // fixed-fee plan
          { price: PRICES.OVERAGE },                // usage-based overage
        ],
        success_url: SUCCESS_URL + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: CANCEL_URL,
        metadata: { api_key: apiKey },
      });

      return res.redirect(303, session.url!);
    } catch (err) {
      next(err);
    }
  }
);
