import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { shareholders } from "./shareholders";

export const incomeTaxPrep = sqliteTable("income_tax_prep", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  return_type: text("return_type", { enum: ["IR4", "IR3"] }).notNull(),
  shareholder_id: text("shareholder_id").references(() => shareholders.id),
  status: text("status", {
    enum: ["draft", "review", "filed"],
  })
    .notNull()
    .default("draft"),
  data_json: text("data_json"), // structured calculation data
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const taxLossRecords = sqliteTable("tax_loss_records", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  loss_amount: real("loss_amount").notNull(),
  carried_forward: real("carried_forward").notNull(),
  continuity_met: integer("continuity_met", { mode: "boolean" })
    .notNull()
    .default(true),
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const personalIncomeSources = sqliteTable("personal_income_sources", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  shareholder_id: text("shareholder_id")
    .notNull()
    .references(() => shareholders.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  source_type: text("source_type", {
    enum: ["employment", "rental", "interest", "dividends_other", "other"],
  }).notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  tax_paid: real("tax_paid").notNull().default(0), // RWT/PAYE already deducted
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const taxSavingsTargets = sqliteTable("tax_savings_targets", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  month: text("month").notNull(), // YYYY-MM
  gst_component: real("gst_component").notNull().default(0),
  income_tax_component: real("income_tax_component").notNull().default(0),
  total_target: real("total_target").notNull().default(0),
  actual_set_aside: real("actual_set_aside"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
