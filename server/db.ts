import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { seedDatabase } from "./seed";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Lightweight auto-migration for local/dev: keep DB in sync with code.
// This avoids runtime failures when new optional columns are added.
async function ensureEmailLogSchema() {
  try {
    await pool.query(
      "ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipients text, ADD COLUMN IF NOT EXISTS attachments text, ADD COLUMN IF NOT EXISTS canceled_at timestamp, ADD COLUMN IF NOT EXISTS error text"
    );
  } catch (err) {
    console.error("[db] ensureEmailLogSchema error:", err);
  }
}

ensureEmailLogSchema();

export const db = drizzle({ client: pool, schema });

// Seed database with demo data on startup
seedDatabase().catch(err => console.error("[db] Seed error:", err));
