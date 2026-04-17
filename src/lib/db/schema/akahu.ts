import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { businesses } from "./businesses";
import { budgetBankAccounts } from "./budget";

export const akahuConnections = sqliteTable("akahu_connections", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  access_token: text("access_token").notNull(), // encrypted
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const akahuAccounts = sqliteTable("akahu_accounts", {
  id: text("id").primaryKey(), // Akahu's account ID
  akahu_connection_id: text("akahu_connection_id")
    .notNull()
    .references(() => akahuConnections.id, { onDelete: "cascade" }),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted
  institution: text("institution").notNull(), // encrypted
  account_type: text("account_type").notNull(), // checking, savings, credit_card
  balance: real("balance").notNull().default(0),
  available_balance: real("available_balance"),
  last_synced_at: integer("last_synced_at", { mode: "timestamp" }),
  linked_budget_account_id: text("linked_budget_account_id").references(
    () => budgetBankAccounts.id,
    { onDelete: "set null" }
  ),
  linked_business_id: text("linked_business_id").references(
    () => businesses.id,
    { onDelete: "set null" }
  ),
  linked_ledger_account_id: text("linked_ledger_account_id"),
  is_tax_savings: integer("is_tax_savings", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const bankTransactions = sqliteTable("bank_transactions", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  akahu_account_id: text("akahu_account_id").notNull(),
  akahu_transaction_id: text("akahu_transaction_id").notNull().unique(),
  date: text("date").notNull(), // YYYY-MM-DD
  description: text("description").notNull(), // encrypted
  amount: real("amount").notNull(), // negative = debit
  balance: real("balance"),
  merchant_name: text("merchant_name"), // encrypted
  reconciliation_status: text("reconciliation_status", {
    enum: ["unmatched", "matched", "reconciled", "excluded"],
  })
    .notNull()
    .default("unmatched"),
  matched_journal_entry_id: text("matched_journal_entry_id"),
  receipt_path: text("receipt_path"),
  receipt_mime: text("receipt_mime"),
  receipt_document_id: text("receipt_document_id"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
