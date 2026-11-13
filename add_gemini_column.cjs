const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Rohini8801%23@localhost:5432/postgres'
});

async function addColumn() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
    `);
    
    console.log('✅ Gemini API key column added successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addColumn();
