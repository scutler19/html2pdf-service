// app/scripts/usage-to-stripe.ts
import 'dotenv/config';
import Stripe from 'stripe';
import { Pool } from 'pg';

// ─── env vars ──────────────────────────────────────────────────────────────
const STRIPE_KEY   = process.env.STRIPE_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;
// ───────────────────────────────────────────────────────────────────────────

// Stripe price IDs
const PRICE_FREE_50     = 'price_1RePk3C06iB64lkCDLdhXZ3x';
const PRICE_STARTER_2K  = 'price_1RePljC06iB64lkCgcNzb4GH';
const PRICE_PRO_12K     = 'price_1RePlwC06iB64lkCU0bV0hMv';
const PRICE_OVERAGE     = 'price_1RePmNC06iB64lkCHtcRAULx';

// included pages per fixed-fee tier
const INCLUDED: Record<string, number> = {
  [PRICE_FREE_50]:    50,
  [PRICE_STARTER_2K]: 2000,
  [PRICE_PRO_12K]:    12000,
};

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: '2024-04-10',          // current GA version
});

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  // 1) pages per API key (yesterday UTC)
  const { rows } = await pool.query(`
    SELECT api_key,
           SUM(pages)::int AS pages
    FROM   page_events
    WHERE  created_at >= date_trunc('day', now()) - interval '1 day'
    GROUP  BY api_key
  `);

  for (const { api_key, pages } of rows) {
    // 2) find the customer’s subscription via metadata search
    const subSearch = await stripe.subscriptions.search({
      query: `metadata['api_key']:'${api_key}'`,
      limit: 1,
    });
    const sub = subSearch.data[0];
    if (!sub) continue;

    // 3) locate the fixed-fee and overage items on that subscription
    const fixedItem = sub.items.data.find(i => INCLUDED[i.price.id] !== undefined);
    const overItem  = sub.items.data.find(i => i.price.id === PRICE_OVERAGE);
    if (!fixedItem || !overItem) continue;

    const included = INCLUDED[fixedItem.price.id];
    const billable = Math.max(0, pages - included);
    if (billable === 0) continue;

    // 4) create the usage record on the *subscription-item* ID
    await stripe.subscriptionItems.createUsageRecord(overItem.id, {
      quantity:  billable,
      timestamp: Math.floor(Date.now() / 1000),
      action:    'increment',
      description: 'Daily HTML→PDF usage',
    });

    console.log(`📤 sent ${billable} pages for key ${api_key}`);
  }

  await pool.end();
})();
