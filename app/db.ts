// app/db.ts
import { Pool } from 'pg';

// Render provides DATABASE_URL in the environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function init() {
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
}

export { pool };
