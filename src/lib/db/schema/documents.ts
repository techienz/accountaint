import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const documentFolders = sqliteTable("document_folders", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // encrypted
  icon: text("icon"), // emoji e.g. "🧾"
  is_system: integer("is_system", { mode: "boolean" }).notNull().default(false),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  folder_id: text("folder_id").references(() => documentFolders.id, { onDelete: "set null" }),
  name: text("name").notNull(), // encrypted
  description: text("description"),
  file_path: text("file_path").notNull(), // {id}.{ext}
  file_size: integer("file_size").notNull(), // bytes
  mime_type: text("mime_type").notNull(),
  document_type: text("document_type", {
    enum: [
      "tax_return_ir4",
      "tax_return_ir3",
      "financial_statement",
      "accountant_report",
      "correspondence",
      "receipt_batch",
      "receipt",
      "bank_receipt",
      "board_resolution",
      "other",
    ],
  })
    .notNull()
    .default("other"),
  tax_year: text("tax_year"), // e.g. "2025"
  linked_entity_type: text("linked_entity_type", {
    enum: ["expense", "asset", "bank_transaction", "invoice", "chat_message", "dividend_declaration"],
  }),
  linked_entity_id: text("linked_entity_id"),
  extracted_text: text("extracted_text"),
  extraction_status: text("extraction_status", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  page_count: integer("page_count"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
