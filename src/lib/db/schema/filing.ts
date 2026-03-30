import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { shareholders } from "./shareholders";

export const filingStatus = sqliteTable("filing_status", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  filing_type: text("filing_type", {
    enum: ["gst", "ir4", "ir3", "provisional_tax"],
  }).notNull(),
  period_key: text("period_key").notNull(), // e.g. "2025-11-01_2026-01-31" for GST, "2026" for IR4
  shareholder_id: text("shareholder_id").references(() => shareholders.id, {
    onDelete: "cascade",
  }),
  status: text("status", {
    enum: ["not_started", "in_progress", "ready", "filed"],
  })
    .notNull()
    .default("not_started"),
  filed_date: text("filed_date"), // YYYY-MM-DD
  data_snapshot: text("data_snapshot"), // JSON snapshot at filing time
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const provisionalTaxPayments = sqliteTable("provisional_tax_payments", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  instalment_number: integer("instalment_number").notNull(),
  due_date: text("due_date").notNull(),
  amount_due: real("amount_due").notNull(),
  amount_paid: real("amount_paid"),
  paid_date: text("paid_date"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
