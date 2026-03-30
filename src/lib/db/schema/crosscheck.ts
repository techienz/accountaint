import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const xeroSnapshots = sqliteTable("xero_snapshots", {
  id: text("id").primaryKey(), // UUID
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  entity_type: text("entity_type").notNull(), // profit_loss, balance_sheet, bank_accounts, invoices, contacts
  data: text("data").notNull(), // JSON string
  data_hash: text("data_hash").notNull(), // SHA-256 hex
  synced_at: integer("synced_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const changeReports = sqliteTable("change_reports", {
  id: text("id").primaryKey(), // UUID
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  entity_type: text("entity_type").notNull(),
  from_snapshot_id: text("from_snapshot_id")
    .notNull()
    .references(() => xeroSnapshots.id),
  to_snapshot_id: text("to_snapshot_id")
    .notNull()
    .references(() => xeroSnapshots.id),
  changes_json: text("changes_json").notNull(), // JSON array of Change objects
  change_count: integer("change_count").notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const anomalies = sqliteTable("anomalies", {
  id: text("id").primaryKey(), // UUID
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  change_report_id: text("change_report_id"),
  severity: text("severity").notNull(), // info, warning, critical
  category: text("category").notNull(), // amount_change, category_change, new_item, deleted_item, timing, duplicate, round_amount, ai_concern
  title: text("title").notNull(),
  description: text("description").notNull(),
  entity_type: text("entity_type").notNull(),
  entity_id: text("entity_id"), // Xero ID of the item
  suggested_question: text("suggested_question"),
  status: text("status").notNull().default("new"), // new, reviewed, dismissed, asked
  reviewed_at: integer("reviewed_at", { mode: "timestamp" }),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
