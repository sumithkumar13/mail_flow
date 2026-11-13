const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Rohini8801%23@localhost:5432/postgres'
});

async function addColumns() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    const result = await client.query(`
      ALTER TABLE email_logs 
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;
    `);
    
    console.log('✅ Columns added successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addColumns();
