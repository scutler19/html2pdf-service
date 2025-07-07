// Script to create a test API key for debugging
const crypto = require('crypto');
const { Pool } = require('pg');

// Create API key using the same method as signup controller
function createApiKey() {
  return crypto.randomBytes(30).toString('base64url');
}

async function createTestKey() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const apiKey = createApiKey();
    const email = 'test@example.com';

    await pool.query(
      `INSERT INTO accounts (api_key, email)
       VALUES ($1, $2)
       ON CONFLICT (api_key) DO NOTHING`,
      [apiKey, email]
    );

    console.log('✅ Test API key created successfully!');
    console.log('API Key:', apiKey);
    console.log('Email:', email);
    console.log('\nTest with:');
    console.log(`curl -X POST https://html2pdf-service-7hq9.onrender.com/api/convert \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "X-API-KEY: ${apiKey}" \\`);
    console.log(`  -d '{"html":"<h1>Hello World</h1>"}' \\`);
    console.log(`  --output test.pdf`);

  } catch (err) {
    console.error('❌ Error creating test key:', err);
  } finally {
    await pool.end();
  }
}

createTestKey(); 