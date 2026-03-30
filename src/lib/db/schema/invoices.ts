import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { contacts } from "./contacts";

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  contact_id: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "restrict" }),
  invoice_number: text("invoice_number").notNull(),
  type: text("type", {
    enum: ["ACCREC", "ACCPAY"],
  }).notNull(),
  status: text("status", {
    enum: ["draft", "sent", "paid", "overdue", "void"],
  })
    .notNull()
    .default("draft"),
  date: text("date").notNull(), // YYYY-MM-DD
  due_date: text("due_date").notNull(), // YYYY-MM-DD
  reference: text("reference"),
  currency_code: text("currency_code").notNull().default("NZD"),
  subtotal: real("subtotal").notNull().default(0),
  gst_total: real("gst_total").notNull().default(0),
  total: real("total").notNull().default(0),
  amount_paid: real("amount_paid").notNull().default(0),
  amount_due: real("amount_due").notNull().default(0),
  gst_inclusive: integer("gst_inclusive", { mode: "boolean" })
    .notNull()
    .default(false),
  notes: text("notes"),
  payment_instructions: text("payment_instructions"),
  overdue_notified_at: integer("overdue_notified_at", { mode: "timestamp" }),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoice_id: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unit_price: real("unit_price").notNull(),
  gst_rate: real("gst_rate").notNull().default(0.15),
  line_total: real("line_total").notNull(), // always ex-GST
  gst_amount: real("gst_amount").notNull(),
  account_code: text("account_code"),
  sort_order: integer("sort_order").notNull().default(0),
  work_contract_id: text("work_contract_id"), // traceability for timesheet-sourced lines
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  invoice_id: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  amount: real("amount").notNull(),
  method: text("method", {
    enum: ["bank_transfer", "cash", "card", "other"],
  })
    .notNull()
    .default("bank_transfer"),
  reference: text("reference"),
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
