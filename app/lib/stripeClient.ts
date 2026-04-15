import Stripe from 'stripe';

let cached: Stripe | undefined;

/**
 * Returns a Stripe client when STRIPE_KEY is set; otherwise null.
 * Lazy init avoids crashing process boot when Stripe is not configured (common in local Docker).
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_KEY?.trim();
  if (!key) {
    return null;
  }
  if (cached === undefined) {
    cached = new Stripe(key, { apiVersion: '2024-04-10' });
  }
  return cached;
}
