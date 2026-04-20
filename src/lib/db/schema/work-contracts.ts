import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { documents } from "./documents";
import { contacts } from "./contacts";

export const workContracts = sqliteTable("work_contracts", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  client_name: text("client_name").notNull(), // encrypted
  contact_id: text("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  contract_type: text("contract_type", {
    enum: ["hourly", "fixed_price", "retainer"],
  }).notNull(),
  hourly_rate: real("hourly_rate"),
  weekly_hours: real("weekly_hours"),
  fixed_price: real("fixed_price"),
  retainer_amount: real("retainer_amount"),
  retainer_hours: real("retainer_hours"),
  start_date: text("start_date").notNull(), // YYYY-MM-DD
  end_date: text("end_date"), // YYYY-MM-DD, null = ongoing
  wt_rate: real("wt_rate").notNull().default(0.0), // 0.0-1.0
  document_id: text("document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  status: text("status", {
    enum: ["active", "expiring_soon", "expired", "completed", "cancelled"],
  })
    .notNull()
    .default("active"),
  expiry_notified_at: integer("expiry_notified_at", { mode: "timestamp" }),
  project_name: text("project_name"),
  project_code: text("project_code"),
  billing_cycle: text("billing_cycle", {
    enum: ["weekly", "fortnightly", "monthly", "on_completion"],
  }),
  invoice_due_day: integer("invoice_due_day"), // day of month payment is due (e.g. 20)
  invoice_send_day: integer("invoice_send_day"), // day of month to send invoice (e.g. 28 for end of month)
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
