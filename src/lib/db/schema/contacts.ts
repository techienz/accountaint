import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted
  email: text("email"), // encrypted
  phone: text("phone"), // encrypted
  address: text("address"), // encrypted
  tax_number: text("tax_number"), // encrypted — contact's IRD/NZBN
  type: text("type", {
    enum: ["customer", "supplier", "both"],
  })
    .notNull()
    .default("customer"),
  default_due_days: integer("default_due_days").notNull().default(20),
  cc_emails: text("cc_emails"), // encrypted — comma-separated CC addresses
  notes: text("notes"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
