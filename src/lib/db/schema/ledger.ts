import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { contacts } from "./contacts";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["asset", "liability", "equity", "revenue", "expense"],
  }).notNull(),
  sub_type: text("sub_type", {
    enum: [
      "current_asset",
      "fixed_asset",
      "current_liability",
      "long_term_liability",
      "equity",
      "revenue",
      "cogs",
      "expense",
    ],
  }).notNull(),
  gst_applicable: integer("gst_applicable", { mode: "boolean" })
    .notNull()
    .default(true),
  is_system: integer("is_system", { mode: "boolean" })
    .notNull()
    .default(false),
  is_active: integer("is_active", { mode: "boolean" })
    .notNull()
    .default(true),
  parent_account_id: text("parent_account_id"),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const journalEntries = sqliteTable("journal_entries", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  entry_number: integer("entry_number").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  description: text("description").notNull(),
  source_type: text("source_type", {
    enum: [
      "manual",
      "invoice",
      "payment",
      "expense",
      "depreciation",
      "shareholder",
      "opening_balance",
      "bank_feed",
      "adjustment",
      "payroll",
    ],
  }).notNull(),
  source_id: text("source_id"),
  is_posted: integer("is_posted", { mode: "boolean" })
    .notNull()
    .default(true),
  is_reversed: integer("is_reversed", { mode: "boolean" })
    .notNull()
    .default(false),
  reversal_of_id: text("reversal_of_id"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const journalLines = sqliteTable("journal_lines", {
  id: text("id").primaryKey(),
  journal_entry_id: text("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id, { onDelete: "cascade" }),
  account_id: text("account_id")
    .notNull()
    .references(() => accounts.id),
  debit: real("debit").notNull().default(0),
  credit: real("credit").notNull().default(0),
  description: text("description"),
  gst_amount: real("gst_amount"),
  gst_rate: real("gst_rate"),
  contact_id: text("contact_id").references(() => contacts.id),
  sort_order: integer("sort_order").notNull().default(0),
});

export const reconciliationRules = sqliteTable("reconciliation_rules", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  match_pattern: text("match_pattern").notNull(), // substring match on description
  account_id: text("account_id")
    .notNull()
    .references(() => accounts.id),
  description_template: text("description_template").notNull(),
  gst_inclusive: integer("gst_inclusive", { mode: "boolean" })
    .notNull()
    .default(true),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
