import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const regulatoryCheckRuns = sqliteTable("regulatory_check_runs", {
  id: text("id").primaryKey(),
  tax_year: integer("tax_year").notNull(),
  status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
  areas_checked: integer("areas_checked").notNull().default(0),
  areas_changed: integer("areas_changed").notNull().default(0),
  areas_uncertain: integer("areas_uncertain").notNull().default(0),
  started_at: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completed_at: integer("completed_at", { mode: "timestamp" }),
});

export const regulatoryChecks = sqliteTable("regulatory_checks", {
  id: text("id").primaryKey(),
  run_id: text("run_id")
    .notNull()
    .references(() => regulatoryCheckRuns.id, { onDelete: "cascade" }),
  tax_year: integer("tax_year").notNull(),
  area: text("area").notNull(),
  current_value: text("current_value").notNull(),
  verified_value: text("verified_value"),
  status: text("status", { enum: ["current", "changed", "uncertain", "error"] }).notNull(),
  source_url: text("source_url"),
  notes: text("notes"),
  applied: integer("applied", { mode: "boolean" }).notNull().default(false),
  checked_at: integer("checked_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
