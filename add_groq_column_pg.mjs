import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addGroqColumn() {
  try {
    console.log("Adding groq_api_key column to users table...");
    
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS groq_api_key TEXT;
    `);
    
    console.log("✅ Groq API key column added successfully");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addGroqColumn();
