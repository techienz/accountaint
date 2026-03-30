import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // encrypted
  service_name: text("service_name").notNull(),
  category: text("category", {
    enum: [
      "telco",
      "software",
      "insurance",
      "leases",
      "banking_eftpos",
      "professional_services",
      "other",
    ],
  }).notNull(),
  cost: real("cost").notNull(),
  billing_cycle: text("billing_cycle", {
    enum: ["monthly", "quarterly", "annual"],
  }).notNull(),
  start_date: text("start_date").notNull(), // YYYY-MM-DD
  term_months: integer("term_months"), // nullable
  renewal_date: text("renewal_date"), // YYYY-MM-DD, nullable
  auto_renew: integer("auto_renew", { mode: "boolean" })
    .notNull()
    .default(false),
  status: text("status", {
    enum: ["active", "expiring_soon", "expired", "cancelled"],
  })
    .notNull()
    .default("active"),
  renewal_notified_at: integer("renewal_notified_at", { mode: "timestamp" }),
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
