// Script to add the fileslap API key to the database
const { Pool } = require('pg');

async function addFileslapKey() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const apiKey = 'sHdaEoYvmni5b9SFA0QzBjTrM4qgRNKtceZfGWID';
    const email = 'fileslap@example.com';

    // Check if the key already exists
    const existing = await pool.query(
      'SELECT api_key FROM accounts WHERE api_key = $1',
      [apiKey]
    );

    if (existing.rows.length > 0) {
      console.log('✅ API key already exists in database');
      console.log('API Key:', apiKey);
      console.log('Email:', email);
    } else {
      // Insert the new API key
      await pool.query(
        `INSERT INTO accounts (api_key, email)
         VALUES ($1, $2)`,
        [apiKey, email]
      );

      console.log('✅ Fileslap API key added successfully!');
      console.log('API Key:', apiKey);
      console.log('Email:', email);
    }

    console.log('\nTest with:');
    console.log(`curl -v -X POST https://api.fileslap.com/api/convert \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "X-API-KEY: ${apiKey}" \\`);
    console.log(`  -d '{"html":"<h1>ping</h1>"}' \\`);
    console.log(`  --output test.pdf`);

  } catch (err) {
    console.error('❌ Error adding fileslap key:', err);
  } finally {
    await pool.end();
  }
}

// Run the script
addFileslapKey(); 