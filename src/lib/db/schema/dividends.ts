import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { documents } from "./documents";

export const dividendDeclarations = sqliteTable("dividend_declarations", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  resolution_number: text("resolution_number").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  tax_year: text("tax_year").notNull(),
  total_amount: real("total_amount").notNull(),
  solvency_confirmed: integer("solvency_confirmed", { mode: "boolean" })
    .notNull()
    .default(true),
  document_id: text("document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
