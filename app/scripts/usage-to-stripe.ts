// app/scripts/usage-to-stripe.ts
import 'dotenv/config';
import Stripe from 'stripe';
import { Pool } from 'pg';

// ─── env vars ──────────────────────────────────────────────────────────────
const STRIPE_KEY   = process.env.STRIPE_KEY!;         // set in Render
const DATABASE_URL = process.env.DATABASE_URL!;       // set in Render
// ───────────────────────────────────────────────────────────────────────────

// Stripe price IDs (copy-pasted from your dashboard)
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

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2023-10-16' });
const pool   = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  // 1) Sum yesterday’s pages per API key
  const { rows } = await pool.query(`
    SELECT api_key,
           SUM(pages)::int AS pages
    FROM   page_events
    WHERE  created_at >= date_trunc('day', now()) - interval '1 day'
    GROUP  BY api_key
  `);

  for (const { api_key, pages } of rows) {
    // 2) Find the customer’s subscription by api_key metadata
    const subs = await stripe.subscriptions.list({ limit: 1, metadata: { api_key } });
    const sub  = subs.data[0];
    if (!sub) continue;

    // 3) Identify the fixed-fee item on the subscription
    const fixedItem = sub.items.data.find(i =>
      i.price.type === 'recurring' && i.price.id in INCLUDED
    );
    if (!fixedItem) continue;

    const included = INCLUDED[fixedItem.price.id];
    const billable = Math.max(0, pages - included);
    if (billable === 0) continue;          // nothing to charge

    // 4) Post usage record to the overage price
    await stripe.subscriptionItems.createUsageRecord(PRICE_OVERAGE, {
      quantity:  billable,
      timestamp: Math.floor(Date.now() / 1000),
      action:    'increment',
    });

    console.log(`📤 sent ${billable} pages for key ${api_key}`);
  }

  await pool.end();
})();
