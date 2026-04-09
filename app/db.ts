// app/db.ts
import { Pool } from 'pg';

/**
 * Use SSL for hosted Postgres (e.g. Render, RDS). Disable for typical local / Docker setups
 * where the server does not speak TLS.
 */
function shouldUseSsl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) {
    return false;
  }

  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    // Unparseable URL: prefer SSL so misconfigured prod strings are not sent in the clear by default.
    return true;
  }

  // Unix-socket style URLs often have an empty host.
  if (hostname === '') {
    return false;
  }

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === 'fileslap-postgres' ||
    hostname === 'host.docker.internal'
  ) {
    return false;
  }

  // Private IPv4 ranges (common for Docker bridge / LAN Postgres).
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return false;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return false;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return false;
  }

  return true;
}

const connectionString = process.env.DATABASE_URL;
const useSsl = shouldUseSsl(connectionString);

const pool = new Pool({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export async function init() {
  try {
    console.log('🔌 Connecting to database...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS page_events (
        id         serial PRIMARY KEY,
        api_key    text      NOT NULL,
        pages      integer   NOT NULL,
        bytes      integer   NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    `);
    console.log('✅ page_events table ensured');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id         serial PRIMARY KEY,
        api_key    text      UNIQUE NOT NULL,
        email      text      NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    `);
    console.log('✅ accounts table ensured');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id              serial PRIMARY KEY,
        api_key         text      UNIQUE NOT NULL,
        subscription_id text      NOT NULL,
        price_id        text      NOT NULL,
        paused          boolean   DEFAULT false,
        created_at      timestamptz DEFAULT now(),
        updated_at      timestamptz DEFAULT now()
      );
    `);
    console.log('✅ subscriptions table ensured');

    console.log('✅ Database initialization completed successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export { pool };
