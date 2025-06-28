// app/scripts/usage-to-stripe.ts
import Stripe from 'stripe';
import { Pool } from 'pg';

// ─── env vars from Render ─────────────────────────────────────────────
const STRIPE_KEY   = process.env.STRIPE_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;
// ──────────────────────────────────────────────────────────────────────

// Are we running with a test secret key?  (sk_test_…)
const IS_TEST = STRIPE_KEY.startsWith('sk_test');

// Stripe price IDs (live vs test)
const PRICES = IS_TEST
  ? {
      FREE:     'price_1ReqQvC06iB64lkCD4C1w73h',
      STARTER:  'price_1ReqRTC06iB64lkC7K2urHlK',
      PRO:      'price_1ReqRtC06iB64lkCu2FSOxqz',
      OVERAGE:  'price_1ReqT7C06iB64lkCFDfgCqO4',
    }
  : {
      FREE:     'price_1RePk3C06iB64lkCDLdhXZ3x',
      STARTER:  'price_1RejY7C06iB64lkCRQh26hSB',
      PRO:      'price_1Reja6C06iB64lkCIjaBIBnC',
      OVERAGE:  'price_1RekXIC06iB64lkCURRkHq7Z',
    };

// included pages per tier
const INCLUDED: Record<string, number> = {
  [PRICES.FREE]:    50,
  [PRICES.STARTER]: 2000,
  [PRICES.PRO]:     12000,
};

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-04-10' });
const pool   = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  // yesterday’s usage per API key
  const { rows } = await pool.query(`
    SELECT api_key, SUM(pages)::int AS pages
    FROM   page_events
    WHERE  created_at >= date_trunc('day', now()) - interval '1 day'
    GROUP  BY api_key
  `);

  for (const { api_key, pages } of rows) {
    // find subscription by metadata
    const subRes = await stripe.subscriptions.search({
      query: `metadata['api_key']:'${api_key}'`,
      limit: 1,
    });
    const sub = subRes.data[0];
    if (!sub) continue;

    const fixedItem = sub.items.data.find(i => INCLUDED[i.price.id] !== undefined);
    const overItem  = sub.items.data.find(i => i.price.id === PRICES.OVERAGE);
    if (!fixedItem || !overItem) continue;

    const included = INCLUDED[fixedItem.price.id];
    const billable = Math.max(0, pages - included);
    if (billable === 0) continue;

    await stripe.subscriptionItems.createUsageRecord(overItem.id, {
      quantity:  billable,
      timestamp: Math.floor(Date.now() / 1000),
      action:    'increment',
    });

    console.log(`📤 sent ${billable} pages for key ${api_key}`);
  }

  await pool.end();
})();
