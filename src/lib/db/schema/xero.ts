import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const xeroConnections = sqliteTable("xero_connections", {
  id: text("id").primaryKey(), // UUID
  business_id: text("business_id")
    .notNull()
    .unique()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tenant_id: text("tenant_id").notNull(),
  tenant_name: text("tenant_name"),
  access_token: text("access_token").notNull(), // encrypted
  refresh_token: text("refresh_token").notNull(), // encrypted
  token_expires_at: integer("token_expires_at", { mode: "timestamp" }).notNull(),
  scopes: text("scopes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const xeroCache = sqliteTable("xero_cache", {
  id: text("id").primaryKey(), // UUID
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  entity_type: text("entity_type").notNull(), // e.g. "profit_loss", "balance_sheet", "bank_accounts", "invoices", "contacts"
  data: text("data").notNull(), // JSON string
  synced_at: integer("synced_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
