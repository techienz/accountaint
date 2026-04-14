import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Stores integration credentials (Akahu, etc.) encrypted in the database.
 * This allows configuration from the Settings UI without env vars.
 */
export const integrationConfig = sqliteTable("integration_config", {
  id: text("id").primaryKey(),
  integration: text("integration").notNull(), // "akahu", "xero", etc.
  key: text("key").notNull(),                 // "app_token", "app_secret", "redirect_uri"
  value: text("value").notNull(),             // encrypted value
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
