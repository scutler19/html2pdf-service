// app/controller/subscribe.ts
import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_KEY!, { apiVersion: '2024-04-10' });

const PRICE_STARTER = 'price_1RePljC06iB64lkCgcNzb4GH';   // Starter 2000 flat fee
const PRICE_PRO     = 'price_1RePlwC06iB64lkCU0bV0hMv';   // Pro 12000   flat fee
const PRICE_OVERAGE = 'price_1RePmNC06iB64lkCHtcRAULx';   // shared $0.0015 / page

// success & cancel return to your marketing site (adjust as needed)
const SUCCESS_URL = 'https://fileslap.com/success';
const CANCEL_URL  = 'https://fileslap.com/cancel';

export const router = Router();

/**
 * GET /api/subscribe/:plan?key=YOUR_API_KEY
 * :plan = starter | pro
 * Returns 303 redirect to Stripe Checkout
 */
router.get('/api/subscribe/:plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.query.key as string;
    if (!apiKey) return res.status(400).send('Missing ?key');

    const plan = req.params.plan;
    const priceId =
      plan === 'starter' ? PRICE_STARTER :
      plan === 'pro'     ? PRICE_PRO     :
      null;

    if (!priceId) return res.status(400).send('Plan must be starter or pro');

    // create (or reuse) a Stripe Customer for this api_key
    const [customer] = await stripe.customers.search({
      query: `metadata['api_key']:'${apiKey}'`,
      limit: 1,
    }).then(r => r.data);

    const customerId = customer
      ? customer.id
      : (await stripe.customers.create({ metadata: { api_key: apiKey } })).id;

    // fixed-fee item + shared overage item on same subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        { price: priceId,       quantity: 1 }, // fixed-fee plan
        { price: PRICE_OVERAGE }               // usage price – omit quantity
      ],
      success_url: SUCCESS_URL + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: CANCEL_URL,
      metadata: { api_key: apiKey },
    });

    return res.redirect(303, session.url!);
  } catch (err) {
    next(err);
  }
});
