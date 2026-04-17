import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { dividendDeclarations } from "./dividends";

export const shareholders = sqliteTable("shareholders", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted
  ird_number: text("ird_number"), // encrypted
  date_of_birth: text("date_of_birth"), // encrypted
  address: text("address"), // encrypted
  ownership_percentage: real("ownership_percentage").notNull(),
  is_director: integer("is_director", { mode: "boolean" })
    .notNull()
    .default(false),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const shareholderTransactions = sqliteTable("shareholder_transactions", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  shareholder_id: text("shareholder_id")
    .notNull()
    .references(() => shareholders.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  type: text("type", {
    enum: ["drawing", "repayment", "salary", "dividend", "other"],
  }).notNull(),
  description: text("description"),
  amount: real("amount").notNull(), // positive = debit/drawing, negative = credit/repayment
  dividend_declaration_id: text("dividend_declaration_id").references(
    () => dividendDeclarations.id,
    { onDelete: "set null" }
  ),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const shareholderSalaryConfig = sqliteTable("shareholder_salary_config", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  shareholder_id: text("shareholder_id")
    .notNull()
    .references(() => shareholders.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  salary_amount: real("salary_amount").notNull().default(0),
  dividend_amount: real("dividend_amount").notNull().default(0),
  imputation_credits: real("imputation_credits").notNull().default(0),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
