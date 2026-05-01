import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const emailLog = sqliteTable("email_log", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  sent_at: integer("sent_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  kind: text("kind", {
    enum: ["invoice", "invoice_reminder", "timesheet", "payslip", "notification", "other"],
  }).notNull(),
  provider: text("provider", { enum: ["smtp", "graph", "unknown"] })
    .notNull()
    .default("unknown"),
  from_address: text("from_address"),
  to_address: text("to_address").notNull(),
  cc_addresses: text("cc_addresses"), // JSON array of strings
  subject: text("subject").notNull(),
  attachment_names: text("attachment_names"), // JSON array of strings
  success: integer("success", { mode: "boolean" }).notNull().default(true),
  error_message: text("error_message"),
  related_entity_type: text("related_entity_type"), // e.g. "invoice" | "work_contract" | "pay_run" | null
  related_entity_id: text("related_entity_id"),
});
