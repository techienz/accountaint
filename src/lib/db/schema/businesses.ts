import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(), // UUID
  owner_user_id: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  entity_type: text("entity_type", {
    enum: ["company", "sole_trader", "partnership", "trust"],
  }).notNull(),
  ird_number: text("ird_number"), // encrypted
  balance_date: text("balance_date").notNull().default("03-31"), // MM-DD
  gst_registered: integer("gst_registered", { mode: "boolean" })
    .notNull()
    .default(false),
  gst_filing_period: text("gst_filing_period", {
    enum: ["monthly", "2monthly", "6monthly"],
  }),
  gst_basis: text("gst_basis", {
    enum: ["invoice", "payments", "hybrid"],
  }),
  provisional_tax_method: text("provisional_tax_method", {
    enum: ["standard", "estimation", "aim"],
  }),
  has_employees: integer("has_employees", { mode: "boolean" })
    .notNull()
    .default(false),
  paye_frequency: text("paye_frequency", {
    enum: ["monthly", "twice_monthly"],
  }),
  invoice_prefix: text("invoice_prefix").default("INV"),
  bill_prefix: text("bill_prefix").default("BILL"),
  next_invoice_number: integer("next_invoice_number").notNull().default(1),
  next_bill_number: integer("next_bill_number").notNull().default(1),
  payment_instructions: text("payment_instructions"),
  invoice_logo_path: text("invoice_logo_path"),
  invoice_custom_footer: text("invoice_custom_footer"),
  invoice_show_branding: integer("invoice_show_branding", { mode: "boolean" })
    .notNull()
    .default(true),
  nzbn: text("nzbn"), // encrypted
  company_number: text("company_number"), // encrypted
  registered_office: text("registered_office"), // encrypted
  incorporation_date: text("incorporation_date"), // YYYY-MM-DD
  fbt_registered: integer("fbt_registered", { mode: "boolean" })
    .notNull()
    .default(false),
  pays_contractors: integer("pays_contractors", { mode: "boolean" })
    .notNull()
    .default(false),
  next_resolution_number: integer("next_resolution_number").notNull().default(1),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
