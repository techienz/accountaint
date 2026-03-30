import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const deadlines = sqliteTable("deadlines", {
  id: text("id").primaryKey(), // UUID
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: [
      "gst",
      "provisional_tax",
      "income_tax",
      "paye",
      "ird_filing",
    ],
  }).notNull(),
  description: text("description").notNull(),
  due_date: text("due_date").notNull(), // ISO date string YYYY-MM-DD
  tax_year: text("tax_year"), // e.g. "2026" for year ending March 2026
  status: text("status", {
    enum: ["upcoming", "due_soon", "overdue", "completed"],
  })
    .notNull()
    .default("upcoming"),
  notified: integer("notified", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
