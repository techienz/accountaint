import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const homeOfficeClaims = sqliteTable("home_office_claims", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  method: text("method", { enum: ["proportional", "sqm_rate"] }).notNull(),
  office_area_sqm: real("office_area_sqm").notNull(),
  total_area_sqm: real("total_area_sqm").notNull(),
  costs_json: text("costs_json").notNull(), // JSON: { rates, insurance, mortgage_interest, rent, power, internet }
  total_claim: real("total_claim").notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const vehicleClaims = sqliteTable("vehicle_claims", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  method: text("method", {
    enum: ["mileage_rate", "actual_cost"],
  }).notNull(),
  total_business_km: real("total_business_km"),
  mileage_rate: real("mileage_rate"),
  business_use_percentage: real("business_use_percentage"),
  actual_costs_json: text("actual_costs_json"), // JSON: { fuel, insurance, rego, maintenance, depreciation }
  total_claim: real("total_claim").notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const vehicleLogbookEntries = sqliteTable("vehicle_logbook_entries", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  vehicle_claim_id: text("vehicle_claim_id")
    .notNull()
    .references(() => vehicleClaims.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  from_location: text("from_location").notNull(),
  to_location: text("to_location").notNull(),
  km: real("km").notNull(),
  purpose: text("purpose"),
  is_business: integer("is_business", { mode: "boolean" })
    .notNull()
    .default(true),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const fbtReturns = sqliteTable("fbt_returns", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  quarter: integer("quarter").notNull(), // 1-4
  benefits_json: text("benefits_json").notNull(), // JSON array of benefits
  total_taxable_value: real("total_taxable_value").notNull().default(0),
  fbt_payable: real("fbt_payable").notNull().default(0),
  status: text("status", { enum: ["draft", "filed"] })
    .notNull()
    .default("draft"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const accConfig = sqliteTable("acc_config", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  cu_code: text("cu_code"),
  cu_description: text("cu_description"),
  liable_earnings: real("liable_earnings").notNull(),
  levy_rate: real("levy_rate").notNull(),
  estimated_levy: real("estimated_levy").notNull(),
  actual_levy: real("actual_levy"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
