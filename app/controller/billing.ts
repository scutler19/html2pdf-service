// app/controller/billing.ts
import { Router, Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_KEY!, { apiVersion: '2024-04-10' });

const RETURN_URL = 'https://fileslap.com/account'; // where Stripe sends them back

export const router = Router();

/**
 * GET /api/billing?key=API_KEY
 * Looks up the Stripe customer by api_key metadata and redirects to
 * the Billing Portal. If no customer exists, returns 404.
 */
router.get('/api/billing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.query.key as string;
    if (!apiKey) return res.status(400).send('Missing ?key');

    // find the customer that owns this api_key
    const search = await stripe.customers.search({
      query: `metadata['api_key']:'${apiKey}'`,
      limit: 1,
    });

    if (!search.data.length) {
      return res.status(404).send('Customer not found for this API key.');
    }

    const customerId = search.data[0].id;

    // create a portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: RETURN_URL,
    });

    return res.redirect(303, session.url);
  } catch (err) {
    next(err);
  }
});
