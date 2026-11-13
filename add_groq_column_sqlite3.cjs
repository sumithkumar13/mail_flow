const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

db.run(`ALTER TABLE users ADD COLUMN groq_api_key TEXT;`, (err) => {
  if (err) {
    if (err.message.includes('duplicate column name')) {
      console.log('ℹ️  Column groq_api_key already exists');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  } else {
    console.log('✅ Added groq_api_key column');
  }
  
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    }
  });
});
