// Script to add unlimited demo API key
const { Pool } = require('pg');

// Demo configuration (matching the TypeScript config)
const DEMO_CONFIG = {
  API_KEY: 'demo-unlimited-key-2024',
  EMAIL: 'demo@fileslap.com',
  DESCRIPTION: 'Unlimited demo key for landing page'
};

async function addDemoKey() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const demoApiKey = DEMO_CONFIG.API_KEY;
    const email = DEMO_CONFIG.EMAIL;

    // Check if demo key already exists
    const existing = await pool.query(
      'SELECT api_key FROM accounts WHERE api_key = $1',
      [demoApiKey]
    );

    if (existing.rows.length > 0) {
      console.log('✅ Demo API key already exists in database');
      console.log('Demo API Key:', demoApiKey);
      console.log('Email:', email);
    } else {
      // Insert the demo API key
      await pool.query(
        `INSERT INTO accounts (api_key, email)
         VALUES ($1, $2)`,
        [demoApiKey, email]
      );

      console.log('✅ Unlimited demo API key added successfully!');
      console.log('Demo API Key:', demoApiKey);
      console.log('Email:', email);
    }

    console.log('\nDemo key features:');
    console.log('- Unlimited usage (bypasses daily/monthly limits)');
    console.log('- No subscription required');
    console.log('- Perfect for landing page demos');
    console.log('- Safe to hardcode in frontend');

  } catch (err) {
    console.error('❌ Error adding demo key:', err);
  } finally {
    await pool.end();
  }
}

// Run the script
addDemoKey(); 