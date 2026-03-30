import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  vendor: text("vendor").notNull(), // encrypted
  description: text("description"),
  amount: real("amount").notNull(), // GST-inclusive
  gst_amount: real("gst_amount"),
  category: text("category", {
    enum: [
      "office_supplies",
      "travel",
      "meals_entertainment",
      "professional_fees",
      "software_subscriptions",
      "vehicle",
      "home_office",
      "utilities",
      "insurance",
      "bank_fees",
      "other",
    ],
  }).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  receipt_path: text("receipt_path"), // {id}.{ext}
  receipt_mime: text("receipt_mime"),
  xero_invoice_id: text("xero_invoice_id"),
  ocr_raw: text("ocr_raw"), // JSON
  status: text("status", {
    enum: ["draft", "confirmed"],
  })
    .notNull()
    .default("draft"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
