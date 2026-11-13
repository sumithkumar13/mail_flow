const Database = require("better-sqlite3");
const { join } = require("path");

const dbPath = join(__dirname, "db.sqlite");
const db = new Database(dbPath);

try {
  console.log("Adding groq_api_key column to users table...");
  
  db.exec(`
    ALTER TABLE users ADD COLUMN groq_api_key TEXT;
  `);
  
  console.log("✅ Groq API key column added successfully");
} catch (error) {
  if (error.message.includes("duplicate column name")) {
    console.log("ℹ️  Column already exists, skipping...");
  } else {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
} finally {
  db.close();
}
