import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  purchase_date: text("purchase_date").notNull(), // YYYY-MM-DD
  cost: real("cost").notNull(), // GST-exclusive
  depreciation_method: text("depreciation_method", {
    enum: ["DV", "SL"],
  }).notNull(),
  depreciation_rate: real("depreciation_rate").notNull(),
  is_low_value: integer("is_low_value", { mode: "boolean" })
    .notNull()
    .default(false),
  // Investment Boost (Budget 2025) eligibility — issue #148. Nullable
  // booleans encode 3-state: true (yes), false (no), null ("Don't know" —
  // user hasn't classified yet). Defaulting to null means we never
  // silently assume eligibility; the calculator surfaces the asset as
  // ineligible until classified.
  is_new: integer("is_new", { mode: "boolean" }),
  is_new_to_nz: integer("is_new_to_nz", { mode: "boolean" }),
  // Explicit opt-out (e.g. residential building, asset held as trading
  // stock). Distinct from is_new=false because a "Don't know" asset
  // shouldn't be opted out — only a deliberate exclusion sets this true.
  ib_excluded: integer("ib_excluded", { mode: "boolean" })
    .notNull()
    .default(false),
  // Persisted IB deduction for the year of acquisition. Recomputed
  // deterministically from cost × rate when is_new flags change.
  ib_claimed_amount: real("ib_claimed_amount"),
  ib_claimed_tax_year: text("ib_claimed_tax_year"), // e.g. "2026"
  disposed: integer("disposed", { mode: "boolean" })
    .notNull()
    .default(false),
  disposal_date: text("disposal_date"), // YYYY-MM-DD
  disposal_price: real("disposal_price"),
  notes: text("notes"),
  receipt_path: text("receipt_path"),
  receipt_mime: text("receipt_mime"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const assetDepreciation = sqliteTable("asset_depreciation", {
  id: text("id").primaryKey(),
  asset_id: text("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tax_year: text("tax_year").notNull(),
  opening_book_value: real("opening_book_value").notNull(),
  depreciation_amount: real("depreciation_amount").notNull(),
  closing_book_value: real("closing_book_value").notNull(),
  depreciation_recovered: real("depreciation_recovered"),
  loss_on_sale: real("loss_on_sale"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
