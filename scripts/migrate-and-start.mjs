#!/usr/bin/env node
// Runs database migrations, then starts the Next.js standalone server.
// Used as the container entrypoint so a fresh `data/` volume auto-initialises.

import { readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH || "/data/accountaint.db";
const migrationsDir = process.env.MIGRATIONS_DIR || "/app/drizzle";

// Ensure parent dir exists
const parent = dirname(dbPath);
if (!existsSync(parent)) {
  mkdirSync(parent, { recursive: true });
}

console.log(`[init] Opening database at ${dbPath}`);
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Track applied migrations (drizzle's naming convention)
const createTrackingTable = `
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at INTEGER
  )
`;
db.prepare(createTrackingTable).run();

const applied = new Set(
  db.prepare("SELECT hash FROM __drizzle_migrations").all().map((r) => r.hash)
);

// Migration helper: if this is a pre-existing database (populated via
// drizzle-kit push rather than applied migrations), skip the baseline
// migration — it would try to re-create tables that already exist.
const existingTables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'")
  .all();
const hasUserTable = existingTables.some((t) => t.name === "users");
if (hasUserTable && applied.size === 0) {
  console.log(
    `[init] Existing database detected (${existingTables.length} tables, no migration history). Marking current migrations as already applied.`
  );
}

if (!existsSync(migrationsDir)) {
  console.warn(
    `[init] No migrations dir at ${migrationsDir} — skipping migrations.`
  );
} else {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const hash = file;
    if (applied.has(hash)) continue;

    // Pre-existing DB: mark this migration as applied without running it,
    // but only if it's the baseline (first) migration. Later migrations
    // should still run normally.
    if (hasUserTable && applied.size === 0 && files.indexOf(file) === 0) {
      console.log(`[init] Marking ${file} as applied (pre-existing schema)`);
      db.prepare(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
      ).run(hash, Date.now());
      applied.add(hash);
      continue;
    }

    console.log(`[init] Applying migration ${file}`);
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    const tx = db.transaction(() => {
      for (const stmt of statements) {
        db.prepare(stmt).run();
      }
      db.prepare(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
      ).run(hash, Date.now());
    });
    tx();
  }
  console.log(`[init] Migrations complete.`);
}

db.close();

console.log(`[init] Starting server...`);
await import("/app/server.js");
