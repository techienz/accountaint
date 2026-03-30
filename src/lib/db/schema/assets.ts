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
  disposed: integer("disposed", { mode: "boolean" })
    .notNull()
    .default(false),
  disposal_date: text("disposal_date"), // YYYY-MM-DD
  disposal_price: real("disposal_price"),
  notes: text("notes"),
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
