import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted
  start_date: text("start_date").notNull(), // YYYY-MM-DD
  employment_type: text("employment_type", {
    enum: ["full_time", "part_time", "casual"],
  }).notNull(),
  pay_type: text("pay_type", {
    enum: ["salary", "hourly"],
  }).notNull(),
  pay_rate: real("pay_rate").notNull(), // annual salary or hourly rate
  hours_per_week: real("hours_per_week").notNull().default(40),
  tax_code: text("tax_code").notNull().default("M"),
  kiwisaver_enrolled: integer("kiwisaver_enrolled", { mode: "boolean" })
    .notNull()
    .default(true),
  kiwisaver_employee_rate: real("kiwisaver_employee_rate")
    .notNull()
    .default(0.035),
  kiwisaver_employer_rate: real("kiwisaver_employer_rate")
    .notNull()
    .default(0.035),
  has_student_loan: integer("has_student_loan", { mode: "boolean" })
    .notNull()
    .default(false),
  leave_annual_balance: real("leave_annual_balance").notNull().default(0),
  leave_sick_balance: real("leave_sick_balance").notNull().default(0),
  leave_annual_accrued_to: text("leave_annual_accrued_to"), // YYYY-MM-DD
  is_active: integer("is_active", { mode: "boolean" })
    .notNull()
    .default(true),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const leaveRecords = sqliteTable("leave_records", {
  id: text("id").primaryKey(),
  employee_id: text("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["annual", "sick", "bereavement", "public_holiday", "unpaid"],
  }).notNull(),
  start_date: text("start_date").notNull(),
  end_date: text("end_date").notNull(),
  days: real("days").notNull(),
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
