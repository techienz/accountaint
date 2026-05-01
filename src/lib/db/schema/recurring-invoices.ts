import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { contacts } from "./contacts";
import { invoices } from "./invoices";

/**
 * Recurring invoice templates. Each schedule generates one draft invoice
 * per cycle; the user reviews and sends (or auto-send if explicitly enabled
 * — opt-in for safety so a wrong template can't quietly bill a client).
 *
 * Daily cron walks active schedules where next_run_date <= today, creates
 * the invoice, advances next_run_date by frequency, optionally emails it.
 */
export const recurringInvoiceSchedules = sqliteTable("recurring_invoice_schedules", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  contact_id: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "restrict" }),
  name: text("name").notNull(),                          // human label e.g. "Acme monthly retainer"
  frequency: text("frequency", {
    enum: ["weekly", "fortnightly", "monthly", "quarterly"],
  }).notNull(),
  next_run_date: text("next_run_date").notNull(),        // YYYY-MM-DD — date the next invoice will be created
  end_date: text("end_date"),                            // YYYY-MM-DD — generation stops once next_run_date > end_date
  due_days: integer("due_days").notNull().default(20),   // days from invoice date to due_date on each generated invoice
  gst_inclusive: integer("gst_inclusive", { mode: "boolean" }).notNull().default(false),
  reference_template: text("reference_template"),         // e.g. "Retainer {{period}}"
  notes: text("notes"),
  payment_instructions: text("payment_instructions"),
  auto_send: integer("auto_send", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  last_generated_at: integer("last_generated_at", { mode: "timestamp" }),
  last_generated_invoice_id: text("last_generated_invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const recurringInvoiceLines = sqliteTable("recurring_invoice_lines", {
  id: text("id").primaryKey(),
  schedule_id: text("schedule_id")
    .notNull()
    .references(() => recurringInvoiceSchedules.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unit_price: real("unit_price").notNull().default(0),
  gst_rate: real("gst_rate").notNull().default(0.15),
  account_code: text("account_code"),
  sort_order: integer("sort_order").notNull().default(0),
});
