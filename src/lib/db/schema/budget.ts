import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { workContracts } from "./work-contracts";

export const budgetConfig = sqliteTable("budget_config", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pay_frequency: text("pay_frequency", {
    enum: ["weekly", "fortnightly", "monthly"],
  })
    .notNull()
    .default("fortnightly"),
  pay_anchor_date: text("pay_anchor_date").notNull(), // YYYY-MM-DD
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetIncomes = sqliteTable("budget_incomes", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // encrypted
  monthly_amount: real("monthly_amount").notNull(),
  work_contract_id: text("work_contract_id").references(
    () => workContracts.id,
    { onDelete: "set null" }
  ),
  notes: text("notes"), // encrypted
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetCategories = sqliteTable("budget_categories", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  sort_order: integer("sort_order").notNull().default(0),
});

export const budgetRecurringItems = sqliteTable("budget_recurring_items", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category_id: text("category_id").references(() => budgetCategories.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(), // encrypted
  notes: text("notes"), // encrypted
  monthly_amount: real("monthly_amount").notNull(),
  due_day: integer("due_day"), // 1-28
  frequency: text("frequency", {
    enum: ["weekly", "fortnightly", "monthly", "quarterly", "annually"],
  })
    .notNull()
    .default("monthly"),
  is_debt: integer("is_debt", { mode: "boolean" }).notNull().default(false),
  debt_principal_portion: real("debt_principal_portion"),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetOneOffExpenses = sqliteTable("budget_one_off_expenses", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category_id: text("category_id").references(() => budgetCategories.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(), // encrypted
  notes: text("notes"), // encrypted
  amount: real("amount").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  is_paid: integer("is_paid", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetDebts = sqliteTable("budget_debts", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted
  balance: real("balance").notNull(),
  monthly_repayment: real("monthly_repayment").notNull(),
  interest_rate: real("interest_rate").notNull(), // annual, e.g. 0.1299
  is_mortgage: integer("is_mortgage", { mode: "boolean" })
    .notNull()
    .default(false),
  is_credit_card: integer("is_credit_card", { mode: "boolean" })
    .notNull()
    .default(false),
  credit_limit: real("credit_limit"),
  property_value: real("property_value"),
  start_date: text("start_date"), // YYYY-MM-DD when the debt started
  end_date: text("end_date"), // YYYY-MM-DD target payoff date
  minimum_payment: real("minimum_payment"), // minimum required payment
  notes: text("notes"), // encrypted
  status: text("status", {
    enum: ["active", "paid_off"],
  })
    .notNull()
    .default("active"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetSavingsGoals = sqliteTable("budget_savings_goals", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted
  current_balance: real("current_balance").notNull().default(0),
  target_amount: real("target_amount"), // null = no target
  fortnightly_contribution: real("fortnightly_contribution").notNull().default(0),
  notes: text("notes"), // encrypted
  status: text("status", {
    enum: ["active", "reached", "paused"],
  })
    .notNull()
    .default("active"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetHolidays = sqliteTable("budget_holidays", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  savings_goal_id: text("savings_goal_id").references(
    () => budgetSavingsGoals.id,
    { onDelete: "set null" }
  ),
  destination: text("destination").notNull(), // encrypted
  date: text("date"), // YYYY-MM-DD approximate
  year: integer("year"),
  accommodation_cost: real("accommodation_cost").notNull().default(0),
  travel_cost: real("travel_cost").notNull().default(0),
  spending_budget: real("spending_budget").notNull().default(0),
  other_costs: real("other_costs").notNull().default(0),
  trip_type: text("trip_type", {
    enum: ["domestic", "international"],
  })
    .notNull()
    .default("domestic"),
  notes: text("notes"), // encrypted
  custom_fields: text("custom_fields"), // JSON string of [{label, value}]
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetBankAccounts = sqliteTable("budget_bank_accounts", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted — "ASB Everyday", "Kiwibank Savings"
  institution: text("institution"), // encrypted — "ASB", "Kiwibank"
  account_type: text("account_type", {
    enum: ["everyday", "savings", "term_deposit", "investment", "other"],
  })
    .notNull()
    .default("everyday"),
  balance: real("balance").notNull().default(0),
  notes: text("notes"), // encrypted
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  last_updated: integer("last_updated", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetInvestments = sqliteTable("budget_investments", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted
  type: text("type", {
    enum: [
      "shares",
      "kiwisaver",
      "term_deposit",
      "managed_fund",
      "crypto",
      "property",
      "other",
    ],
  }).notNull(),
  platform: text("platform"), // encrypted — "Sharesies", "InvestNow"
  units: real("units"),
  cost_basis: real("cost_basis").notNull(),
  current_value: real("current_value").notNull(),
  currency: text("currency", { enum: ["NZD", "AUD", "USD"] })
    .notNull()
    .default("NZD"),
  nzd_rate: real("nzd_rate").notNull().default(1),
  purchase_date: text("purchase_date"), // YYYY-MM-DD
  notes: text("notes"), // encrypted
  status: text("status", { enum: ["active", "sold"] })
    .notNull()
    .default("active"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetInvestmentValueHistory = sqliteTable(
  "budget_investment_value_history",
  {
    id: text("id").primaryKey(),
    investment_id: text("investment_id")
      .notNull()
      .references(() => budgetInvestments.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: real("value").notNull(),
    nzd_rate: real("nzd_rate").notNull().default(1),
    recorded_at: integer("recorded_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  }
);

export const budgetTransactions = sqliteTable("budget_transactions", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bank_account_id: text("bank_account_id").references(
    () => budgetBankAccounts.id,
    { onDelete: "set null" }
  ),
  category_id: text("category_id").references(() => budgetCategories.id, {
    onDelete: "set null",
  }),
  date: text("date").notNull(), // YYYY-MM-DD
  description: text("description").notNull(), // encrypted
  amount: real("amount").notNull(), // negative = debit, positive = credit
  balance: real("balance"), // running balance from bank (nullable)
  type: text("type", { enum: ["debit", "credit"] }).notNull(),
  dedup_hash: text("dedup_hash").notNull(), // SHA-256(date|amount|description)
  is_categorised: integer("is_categorised", { mode: "boolean" })
    .notNull()
    .default(false),
  notes: text("notes"), // encrypted
  import_batch: text("import_batch"), // groups transactions by import session
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const budgetHolidayAttachments = sqliteTable("budget_holiday_attachments", {
  id: text("id").primaryKey(),
  holiday_id: text("holiday_id")
    .notNull()
    .references(() => budgetHolidays.id, { onDelete: "cascade" }),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted
  type: text("type", {
    enum: ["link", "file"],
  }).notNull(),
  url: text("url"), // for links
  file_path: text("file_path"), // for uploaded files
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
