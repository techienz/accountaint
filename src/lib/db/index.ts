import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

let db: BetterSQLite3Database<typeof schema> | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (db) return db;

  // Validate required env vars
  if (!process.env.APP_ENCRYPTION_KEY || process.env.APP_ENCRYPTION_KEY.length < 64) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be set (64 hex chars = 32 bytes). Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "accountaint.db");

  const sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  db = drizzle(sqlite, { schema });

  return db;
}

export { schema };
