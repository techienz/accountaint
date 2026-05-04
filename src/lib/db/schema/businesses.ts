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
  // For 2-monthly filers only. NZ has two 2-monthly cycles (per IRD):
  //   "A" — period ends Jan/Mar/May/Jul/Sep/Nov
  //   "B" — period ends Feb/Apr/Jun/Aug/Oct/Dec
  // IRD assigns one when you register; check myIR > Returns to confirm.
  // NULL = unconfigured (deadline calculator falls back to A and warns).
  // Issue #160.
  gst_2monthly_cycle: text("gst_2monthly_cycle", {
    enum: ["A", "B"],
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
  // True if linked to a registered NZ tax agent for the extension-of-time
  // scheme. Without one, IR4/IR3 due 7 July (year+1) and terminal tax
  // due 7 February (year+1). With one, IR4/IR3 due 31 March (year+2) and
  // terminal tax due 7 April (year+1). Issue #163.
  tax_agent_linked: integer("tax_agent_linked", { mode: "boolean" })
    .notNull()
    .default(false),
  // True if the business pays dividends to shareholders. Triggers RWT
  // deadline emission: IR15P (monthly RWT payment, 20th of next month
  // when a dividend is paid) and IR15S (annual reconciliation, 31 May
  // for tax year ending 31 March). Issue #165.
  pays_dividends: integer("pays_dividends", { mode: "boolean" })
    .notNull()
    .default(false),
  // True if the business has a shareholder-employee drawing salary
  // (common sole-director pattern). Affects ACC Work Account levy
  // emission — sole-director companies with a shareholder-employee ARE
  // liable for the levy on those earnings, even with no PAYE staff.
  // Issue #168.
  has_shareholder_employee: integer("has_shareholder_employee", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  next_resolution_number: integer("next_resolution_number").notNull().default(1),
  auto_invoice_reminders: integer("auto_invoice_reminders", { mode: "boolean" })
    .notNull()
    .default(true),
  invoice_reminder_cadence_days: integer("invoice_reminder_cadence_days").notNull().default(7),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
