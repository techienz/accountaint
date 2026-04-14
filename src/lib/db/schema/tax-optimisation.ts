import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const taxOptimisationResults = sqliteTable("tax_optimisation_results", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: integer("tax_year").notNull(),
  snapshot: text("snapshot").notNull(),
  recommendations: text("recommendations").notNull(),
  total_potential_saving: real("total_potential_saving").notNull(),
  opportunity_count: integer("opportunity_count").notNull(),
  scanned_at: integer("scanned_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
