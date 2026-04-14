import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(), // UUID
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  sanitised_content: text("sanitised_content"), // PII-stripped version sent to API
  attachments: text("attachments"), // JSON array: [{ filename, mimetype, path, description }]
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
