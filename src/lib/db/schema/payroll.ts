import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { employees } from "./employees";

export const payRuns = sqliteTable("pay_runs", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  period_start: text("period_start").notNull(),
  period_end: text("period_end").notNull(),
  pay_date: text("pay_date").notNull(),
  frequency: text("frequency", { enum: ["weekly", "fortnightly"] }).notNull(),
  status: text("status", { enum: ["draft", "finalised"] }).notNull().default("draft"),
  journal_entry_id: text("journal_entry_id"),
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  finalised_at: integer("finalised_at", { mode: "timestamp" }),
});

export const payRunLines = sqliteTable("pay_run_lines", {
  id: text("id").primaryKey(),
  pay_run_id: text("pay_run_id")
    .notNull()
    .references(() => payRuns.id, { onDelete: "cascade" }),
  employee_id: text("employee_id")
    .notNull()
    .references(() => employees.id),
  hours: real("hours"),
  pay_rate: real("pay_rate").notNull(),
  gross_pay: real("gross_pay").notNull(),
  paye: real("paye").notNull(),
  kiwisaver_employee: real("kiwisaver_employee").notNull().default(0),
  kiwisaver_employer: real("kiwisaver_employer").notNull().default(0),
  esct: real("esct").notNull().default(0),
  student_loan: real("student_loan").notNull().default(0),
  net_pay: real("net_pay").notNull(),
  tax_code: text("tax_code").notNull(),
  kiwisaver_employee_rate: real("kiwisaver_employee_rate"),
  kiwisaver_employer_rate: real("kiwisaver_employer_rate"),
});
