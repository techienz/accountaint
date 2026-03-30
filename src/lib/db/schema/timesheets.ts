import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { workContracts } from "./work-contracts";
import { invoices } from "./invoices";

export const timesheetEntries = sqliteTable("timesheet_entries", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  work_contract_id: text("work_contract_id")
    .notNull()
    .references(() => workContracts.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  start_time: text("start_time"), // HH:MM
  end_time: text("end_time"), // HH:MM
  duration_minutes: integer("duration_minutes").notNull(),
  description: text("description"),
  billable: integer("billable", { mode: "boolean" }).notNull().default(true),
  hourly_rate: real("hourly_rate"),
  status: text("status", {
    enum: ["draft", "approved", "invoiced"],
  })
    .notNull()
    .default("draft"),
  invoice_id: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
