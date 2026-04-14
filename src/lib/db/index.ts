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

  // Checkpoint any pending WAL writes from a previous process
  sqlite.pragma("wal_checkpoint(TRUNCATE)");

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  db = drizzle(sqlite, { schema });

  // Checkpoint WAL on graceful shutdown so data isn't lost on restart
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      try {
        sqlite.pragma("wal_checkpoint(TRUNCATE)");
        sqlite.close();
      } catch {
        // DB may already be closed
      }
    });
  }

  return db;
}

export { schema };
